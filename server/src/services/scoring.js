// Core of the project. Keep this pure + unit-testable.
const LATE_CREDIT = 0.5; // finishing after the deadline earns half credit
const dayEnd = d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local date, no UTC shift
export const weekStart = d => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
};

// Priority-weighted completion rate per week (0-100), only for weeks whose deadline has passed.
export function weeklyRates(tasks, now = new Date()) {
  const map = new Map();
  for (const t of tasks) {
    if (dayEnd(t.dueDate) > now && !t.completedAt) continue; // not due yet
    const k = ymd(weekStart(t.dueDate));
    const w = map.get(k) || { week: k, total: 0, done: 0, count: 0, doneCount: 0, missed: [], byCategory: {} };
    const c = (w.byCategory[t.category] ||= { total: 0, done: 0 });
    const credit = !t.completedAt ? 0 : t.completedAt <= dayEnd(t.dueDate) ? 1 : LATE_CREDIT;
    w.total += t.priority; w.done += t.priority * credit; w.count++;
    if (credit > 0) w.doneCount++; else w.missed.push(t.title);
    c.total += t.priority; c.done += t.priority * credit;
    map.set(k, w);
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({ ...w, rate: Math.round((100 * w.done) / w.total) }));
}

// Recent weeks matter more (EMA), minus a penalty for the overdue backlog.
export function driftScore(weeks, tasks, now = new Date()) {
  if (!weeks.length) return { score: null, risk: 'No data yet', backlog: 0 };
  const alpha = 0.4;
  let ema = weeks[0].rate;
  for (const w of weeks.slice(1)) ema = alpha * w.rate + (1 - alpha) * ema;
  const backlog = tasks.filter(t => !t.completedAt && dayEnd(t.dueDate) < now).reduce((s, t) => s + t.priority, 0);
  const score = Math.max(0, Math.round(ema - Math.min(15, backlog * 0.5)));
  const risk = score >= 75 ? 'Safe' : score >= 55 ? 'Slipping' : score >= 35 ? 'At Risk' : 'Critical';
  return { score, risk, backlog };
}

// First week where the 2-week average falls 20+ points under the previous 3-week average.
export function findDriftPoint(weeks) {
  const avg = a => a.reduce((s, x) => s + x.rate, 0) / a.length;
  for (let i = 3; i < weeks.length - 1; i++) {
    const base = avg(weeks.slice(i - 3, i));
    if (avg(weeks.slice(i, i + 2)) < base - 20 && weeks[i].rate < base - 15) return weeks[i].week;
  }
  return null;
}

export const statusOf = r => (r >= 80 ? 'Strong' : r >= 60 ? 'Okay' : r >= 35 ? 'Slipping' : 'Missed');
const catRates = bc => Object.entries(bc).map(([c, v]) => ({ c, rate: Math.round((100 * v.done) / v.total) })).sort((a, b) => a.rate - b.rate);

// Week-wise and month-wise performance reports.
export function buildReport(tasks, now = new Date()) {
  const raw = weeklyRates(tasks, now);
  const weeks = raw.map((w, i) => {
    const cr = catRates(w.byCategory);
    return { week: w.week, rate: w.rate, delta: i ? w.rate - raw[i - 1].rate : null, status: statusOf(w.rate),
      done: w.doneCount, total: w.count, worst: cr[0]?.c, best: cr[cr.length - 1]?.c, missed: w.missed };
  });
  const groups = {};
  raw.forEach((w, i) => {
    const g = (groups[w.week.slice(0, 7)] ||= { month: w.week.slice(0, 7), weeks: [], cat: {} });
    g.weeks.push(weeks[i]);
    Object.entries(w.byCategory).forEach(([c, v]) => { const x = (g.cat[c] ||= { total: 0, done: 0 }); x.total += v.total; x.done += v.done; });
  });
  const months = Object.values(groups).map(g => {
    const rate = Math.round(g.weeks.reduce((s, w) => s + w.rate, 0) / g.weeks.length);
    return { month: g.month, rate, status: statusOf(rate), slippedWeeks: g.weeks.filter(w => w.rate < 60).length,
      done: g.weeks.reduce((s, w) => s + w.done, 0), total: g.weeks.reduce((s, w) => s + w.total, 0), worst: catRates(g.cat)[0]?.c, weeks: g.weeks };
  });
  months.forEach((m, i) => { m.delta = i ? m.rate - months[i - 1].rate : null; });
  return { weeks, months };
}
