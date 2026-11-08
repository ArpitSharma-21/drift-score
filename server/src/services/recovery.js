import { weeklyRates, driftScore, findDriftPoint, scoreTrend } from './scoring.js';
import { computeStreak, dayKey } from './streak.js';

export const CATS = ['dsa', 'assignment', 'project', 'study'];

// Everything the AI is allowed to know, computed by our own code from the database.
export function buildFacts(tasks, { now = new Date(), offset = 0, lastPlan = null } = {}) {
  const weeks = weeklyRates(tasks, now), sc = driftScore(weeks, tasks, now), topicMap = {};
  for (const t of tasks) {
    const name = (t.topic || '').trim();
    if (!name || (new Date(t.dueDate) > now && !t.completedAt)) continue;
    const m = (topicMap[name.toLowerCase()] ||= { topic: name, category: t.category, total: 0, done: 0, overdue: 0 });
    m.total++; if (t.completedAt) m.done++; else m.overdue++;
  }
  const topics = Object.values(topicMap).map(m => ({ ...m, rate: Math.round((100 * m.done) / m.total) })).sort((a, b) => a.rate - b.rate || b.overdue - a.overdue).slice(0, 12);
  const since = now.getTime() - 21 * 864e5;
  const missed = tasks.filter(t => !t.completedAt && new Date(t.dueDate) < now && new Date(t.dueDate).getTime() >= since)
    .sort((a, b) => b.priority - a.priority).slice(0, 12).map(t => ({ title: t.title, category: t.category, topic: t.topic || null, priority: t.priority }));
  const recent = tasks.filter(t => t.completedAt && now.getTime() - new Date(t.completedAt).getTime() < 28 * 864e5);
  const activeDays = new Set(recent.map(t => dayKey(t.completedAt, offset))).size;
  return {
    score: sc.score, risk: sc.risk, overdueBacklogPoints: sc.backlog, driftPoint: findDriftPoint(weeks), trend: scoreTrend(weeks),
    recentWeeks: weeks.slice(-8).map(w => ({ week: w.week, rate: w.rate, byCategory: Object.fromEntries(Object.entries(w.byCategory).map(([c, v]) => [c, Math.round((100 * v.done) / v.total)])) })),
    topics, missed, avgFinishedPerActiveDay: activeDays ? +(recent.length / activeDays).toFixed(1) : 0,
    streak: computeStreak(tasks.filter(t => t.completedAt).map(t => t.completedAt), offset, now).current, lastPlan,
  };
}

export function parseJson(t) {
  try { return JSON.parse(t); } catch { /* try to find an object inside the text */ }
  const m = String(t || '').match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

// The AI's output is untrusted: clamp, dedupe and cap everything before anything reaches the database.
export function validatePlan(raw, { maxPerDay = 3, existing = [] } = {}) {
  const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const seen = new Set(existing.map(s => String(s).toLowerCase().trim())), items = [];
  for (const it of Array.isArray(raw?.plan) ? raw.plan : []) {
    const title = str(it?.title, 120), day = Math.round(Number(it?.day)), pr = Math.round(Number(it?.priority));
    if (!title || !(day >= 1 && day <= 7) || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    items.push({ day, title, category: CATS.includes(it?.category) ? it.category : 'study', topic: str(it?.topic, 40), priority: pr >= 1 && pr <= 5 ? pr : 3 });
  }
  const byDay = {}; items.forEach(i => (byDay[i.day] ||= []).push(i));
  const kept = Object.values(byDay).flatMap(list => list.sort((a, b) => b.priority - a.priority).slice(0, maxPerDay))
    .sort((a, b) => a.day - b.day || b.priority - a.priority).slice(0, 10);
  const causes = (Array.isArray(raw?.causes) ? raw.causes : []).slice(0, 4).map(c => ({ text: str(c?.text, 220), evidence: str(c?.evidence, 220) })).filter(c => c.text);
  return { summary: str(raw?.summary, 400), causes, items: kept };
}

export const SYSTEM = `You are Drift AI, a study recovery coach inside a student task tracker.
Use ONLY the data in the user message: "facts" (computed by the app) and "notes" (excerpts the student saved). Never invent topics, scores or notes.
1. Work out why the score is slipping. Each cause needs "evidence" that quotes a number from facts or names a note (for example "Binary Trees: 1 of 5 tasks done" or "note 2").
2. If the data is too thin to explain it, say so in "summary" and keep the plan short and general.
3. Build a plan for the next 7 days: small concrete tasks (30 to 90 minutes), weakest topics first, never more than limits.maxTasksPerDay per day. If facts.lastPlan.rate is under 50, make the plan lighter.
Reply with JSON only, in exactly this shape:
{"summary":"...","causes":[{"text":"...","evidence":"..."}],"plan":[{"day":1,"title":"...","category":"dsa|assignment|project|study","topic":"...","priority":1}]}`;

// llm is injected so this can be tested without a network.
export async function makePlan({ facts, notes, focus, existing, llm }) {
  const maxPerDay = Math.min(4, Math.max(2, Math.ceil((facts.avgFinishedPerActiveDay || 2) * 1.3)));
  const user = JSON.stringify({
    focus: focus || 'Find out why my score is dropping and plan my recovery.', facts,
    notes: notes.map((n, i) => ({ id: i + 1, from: n.title, text: n.text.slice(0, 600) })), limits: { maxTasksPerDay: maxPerDay, days: 7, categories: CATS },
  });
  const raw = parseJson(await llm(SYSTEM, user));
  if (!raw) throw new Error('The AI did not return a usable plan. Please try again.');
  const plan = validatePlan(raw, { maxPerDay, existing });
  if (!plan.items.length) throw new Error('The AI plan had no valid tasks. Try again with a more specific question.');
  return { ...plan, maxPerDay };
}
