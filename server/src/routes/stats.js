import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import { weeklyRates, driftScore, findDriftPoint, buildReport } from '../services/scoring.js';
const r = Router();
r.get('/', auth, async (req, res) => {
  const tasks = await Task.find({ user: req.userId });
  const weeks = weeklyRates(tasks);
  const months = {};
  for (const w of weeks) { const m = w.week.slice(0, 7); (months[m] ||= []).push(w.rate); }
  res.json({
    ...driftScore(weeks, tasks),
    driftPoint: findDriftPoint(weeks),
    weeks,
    months: Object.entries(months).map(([month, v]) => ({ month, rate: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })),
  });
});
r.get('/report', auth, async (req, res) => {
  const tasks = await Task.find({ user: req.userId });
  res.json({ ...buildReport(tasks), driftPoint: findDriftPoint(weeklyRates(tasks)) });
});
export default r;
