// Streaks and badges. A day counts when at least one task was completed that day (in the user's own timezone).
export const MILESTONES = [
  { id: 's7', days: 7, name: 'Getting Steady', line: 'A full week of showing up.' },
  { id: 's14', days: 14, name: 'Two-Week Hold', line: 'Two weeks without a gap.' },
  { id: 's21', days: 21, name: 'Habit Taking Shape', line: 'Twenty-one days in. It starts to stick.' },
  { id: 's30', days: 30, name: 'Full Month', line: 'A whole month, every single day.' },
  { id: 's45', days: 45, name: 'Locked In', line: 'Past the point where most people quit.' },
  { id: 's60', days: 60, name: 'Two Months Strong', line: 'Sixty days of steady work.' },
  { id: 's90', days: 90, name: 'Quarter Mark', line: 'A whole term of daily effort.' },
  { id: 's120', days: 120, name: 'Unshakeable', line: 'Four months. Exams do not scare this streak.' },
  { id: 's180', days: 180, name: 'Half-Year Hold', line: 'Half a year of not drifting.' },
  { id: 's365', days: 365, name: 'Zero Drift', line: 'A full year. The streak never slipped.' },
];

// offsetMin is the browser's getTimezoneOffset() (IST is -330), so days are bucketed in the user's local time.
export const dayKey = (d, offsetMin = 0) => new Date(new Date(d).getTime() - offsetMin * 60000).toISOString().slice(0, 10);
const shift = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const gap = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);

export function computeStreak(dates, offsetMin = 0, now = new Date()) {
  const days = [...new Set(dates.map(d => dayKey(d, offsetMin)))].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && gap(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  const set = new Set(days), today = dayKey(now, offsetMin);
  let cursor = set.has(today) ? today : shift(today, -1), current = 0; // today may still be to come
  while (set.has(cursor)) { current++; cursor = shift(cursor, -1); }
  return { current, best, activeToday: set.has(today) };
}
