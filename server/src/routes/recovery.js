import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import Doc from '../models/Doc.js';
import Chunk from '../models/Chunk.js';
import RecoveryPlan from '../models/RecoveryPlan.js';
import { weeklyRates, scoreTrend } from '../services/scoring.js';
import { dayKey } from '../services/streak.js';
import { chunkText, rank, embedDocs, embedQuery } from '../services/rag.js';
import { buildFacts, makePlan } from '../services/recovery.js';
import { generate, available } from '../services/llm.js';
const r = Router();
r.use(auth);
const perUser = max => rateLimit({ windowMs: 3600e3, max, keyGenerator: req => String(req.userId), message: { error: 'Too many requests. Please try again in a while.' } });
const tzOf = req => { const n = parseInt(req.headers['x-tz'], 10); return Number.isFinite(n) ? n : 0; };
const pub = p => p && ({ id: p._id, status: p.status, focus: p.focus, summary: p.summary, causes: p.causes, items: p.items, sources: p.sources, mode: p.mode, trace: p.trace, result: p.result, createdAt: p.createdAt });

// ---------- study material (the "notes" the AI can search) ----------
r.get('/docs', async (req, res) => res.json(await Doc.find({ user: req.userId }).sort({ createdAt: -1 }).select('title chars chunkCount mode createdAt')));

r.post('/docs', perUser(10), async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 80), text = String(req.body?.text || '').trim();
  if (!title) return res.status(400).json({ error: 'Give it a title.' });
  if (text.length < 40) return res.status(400).json({ error: 'Paste a bit more text (at least a few lines).' });
  if (text.length > 20000) return res.status(400).json({ error: 'That is too long. The limit is 20,000 characters per note. Split it into two.' });
  if ((await Doc.countDocuments({ user: req.userId })) >= 10) return res.status(400).json({ error: 'You can keep up to 10 notes. Delete one first.' });
  const pieces = chunkText(text), used = await Chunk.countDocuments({ user: req.userId });
  if (used + pieces.length > 150) return res.status(400).json({ error: 'You have reached the storage limit for notes. Delete one first.' });
  let vecs = null;
  try { vecs = await embedDocs(pieces); } catch (e) { console.error('[embed]', e.message); } // falls back to keyword search
  const doc = await Doc.create({ user: req.userId, title, chars: text.length, chunkCount: pieces.length, mode: vecs ? 'meaning' : 'keyword' });
  await Chunk.insertMany(pieces.map((t, i) => ({ user: req.userId, doc: doc._id, idx: i, text: t, embedding: vecs ? vecs[i] : undefined })));
  res.json({ id: doc._id, title, chunkCount: pieces.length, mode: doc.mode });
});

r.delete('/docs/:id', async (req, res) => {
  const doc = await Doc.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (doc) await Chunk.deleteMany({ doc: doc._id, user: req.userId });
  res.json({ ok: true });
});

// ---------- recovery plans ----------
// If every task of an active plan is done or well past due, close the plan and record the real outcome.
async function settle(plan, tasks) {
  const mine = tasks.filter(t => String(t.planId) === String(plan._id));
  const done = mine.filter(t => t.completedAt).length, over = mine.every(t => t.completedAt || new Date(t.dueDate) < new Date(Date.now() - 864e5));
  if (mine.length && over) { plan.status = 'finished'; plan.result = { done, total: mine.length }; await plan.save(); }
  return { total: mine.length, done, overdue: mine.filter(t => !t.completedAt && new Date(t.dueDate) < new Date()).length };
}

r.get('/status', async (req, res) => {
  const tasks = await Task.find({ user: req.userId });
  let plan = await RecoveryPlan.findOne({ user: req.userId, status: { $in: ['proposed', 'active'] } }).sort({ createdAt: -1 });
  let progress = null;
  if (plan?.status === 'active') { progress = await settle(plan, tasks); if (plan.status === 'finished') progress = { ...progress, finished: true }; }
  res.json({ trend: scoreTrend(weeklyRates(tasks)), plan: plan?.status === 'finished' ? null : pub(plan), progress, aiReady: available().length > 0 });
});

r.post('/plan', perUser(6), async (req, res) => {
  if (!available().length) return res.status(503).json({ error: 'AI key missing on the server. Add GROQ_API_KEY or GEMINI_API_KEY.' });
  const active = await RecoveryPlan.findOne({ user: req.userId, status: 'active' });
  if (active) { const s = await settle(active, await Task.find({ user: req.userId })); if (active.status === 'active') return res.status(409).json({ error: `You already have a plan in progress (${s.done} of ${s.total} done). Finish it first.` }); }
  const focus = String(req.body?.focus || '').trim().slice(0, 300), trace = [];
  const step = async (name, fn) => { const t0 = Date.now(); const v = await fn(); trace.push({ step: name, ms: Date.now() - t0 }); return v; };

  const { tasks, facts } = await step('Collected your history', async () => {
    const tasks = await Task.find({ user: req.userId });
    const last = await RecoveryPlan.findOne({ user: req.userId, status: 'finished' }).sort({ createdAt: -1 });
    return { tasks, facts: buildFacts(tasks, { offset: tzOf(req), lastPlan: last?.result?.total ? { done: last.result.done, total: last.result.total, rate: Math.round((100 * last.result.done) / last.result.total) } : null }) };
  });
  const { hits, mode } = await step('Searched your notes', async () => {
    const [docs, chunks] = await Promise.all([Doc.find({ user: req.userId }).select('title'), Chunk.find({ user: req.userId })]);
    if (!chunks.length) return { hits: [], mode: 'none' };
    const titles = new Map(docs.map(d => [String(d._id), d.title]));
    const query = [focus, ...facts.topics.slice(0, 3).map(t => t.topic), ...facts.missed.slice(0, 3).map(m => m.title)].join(' ');
    let qvec = null; try { qvec = await embedQuery(query); } catch (e) { console.error('[embed]', e.message); }
    const top = rank(query, chunks.map(c => ({ text: c.text, embedding: c.embedding, title: titles.get(String(c.doc)) || 'Note' })), qvec, 5);
    return { hits: top.map(t => t.chunk), mode: top[0]?.mode || 'keyword' };
  });
  const plan = await step('Investigated and planned', () => makePlan({
    facts, notes: hits, focus, existing: tasks.filter(t => !t.completedAt).map(t => t.title),
    llm: (system, user) => generate(system, user, { maxTokens: 1500, json: true }),
  }));
  await RecoveryPlan.updateMany({ user: req.userId, status: 'proposed' }, { status: 'dismissed' });
  const saved = await RecoveryPlan.create({ user: req.userId, focus, summary: plan.summary, causes: plan.causes, items: plan.items,
    sources: hits.map(h => ({ title: h.title, snippet: h.text.slice(0, 160) })), mode, trace, demo: tasks.some(t => t.source === 'sample') });
  res.json(pub(saved));
});

r.post('/plan/:id/approve', perUser(20), async (req, res) => {
  const plan = await RecoveryPlan.findOne({ _id: req.params.id, user: req.userId, status: 'proposed' });
  if (!plan) return res.status(404).json({ error: 'This plan is no longer available.' });
  const want = Array.isArray(req.body?.items) ? [...new Set(req.body.items.map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < plan.items.length) : plan.items.map((_, i) => i);
  if (!want.length) return res.status(400).json({ error: 'Pick at least one task.' });
  const today = new Date(dayKey(new Date(), tzOf(req)) + 'T00:00:00Z');
  const docs = want.map(i => { const it = plan.items[i]; return { user: req.userId, title: it.title, category: it.category, topic: it.topic, priority: it.priority, source: 'drift-ai', planId: plan._id, dueDate: new Date(today.getTime() + it.day * 864e5) }; });
  await Task.insertMany(docs);
  plan.status = 'active'; plan.approvedAt = new Date(); await plan.save();
  res.json({ created: docs.length });
});

r.post('/plan/:id/dismiss', async (req, res) => { await RecoveryPlan.updateOne({ _id: req.params.id, user: req.userId, status: 'proposed' }, { status: 'dismissed' }); res.json({ ok: true }); });
export default r;
