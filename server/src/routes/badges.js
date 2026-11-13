import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { MILESTONES, computeStreak } from '../services/streak.js';
const r = Router();

r.get('/', auth, async (req, res) => {
  const [tasks, user] = await Promise.all([
    Task.find({ user: req.userId, completedAt: { $ne: null } }).select('completedAt source'),
    User.findById(req.userId),
  ]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const off = parseInt(req.headers['x-tz'], 10) || 0;
  const real = computeStreak(tasks.filter(t => t.source !== 'sample').map(t => t.completedAt), off);
  const hasSample = tasks.some(t => t.source === 'sample');
  const shown = hasSample ? computeStreak(tasks.map(t => t.completedAt), off) : real; // sample data is shown, but never earns anything
  const best = Math.max(user.bestStreak || 0, real.best); // earned badges never get taken away
  const have = new Map((user.badges || []).map(b => [b.id, b.earnedAt]));
  const fresh = [];
  for (const m of MILESTONES) if (best >= m.days && !have.has(m.id)) { have.set(m.id, new Date()); fresh.push(m.id); }
  if (fresh.length || best !== (user.bestStreak || 0)) {
    user.bestStreak = best; user.badges = [...have].map(([id, earnedAt]) => ({ id, earnedAt })); await user.save();
  }
  const showBest = Math.max(best, shown.best);
  const badges = MILESTONES.map(m => { const earned = have.has(m.id), demo = !earned && showBest >= m.days; return { ...m, earned: earned || demo, demo, earnedAt: have.get(m.id) || null }; });
  const next = badges.find(b => !b.earned);
  res.json({
    current: shown.current, best: showBest, activeToday: shown.activeToday, fresh, demo: hasSample,
    next: next && { id: next.id, days: next.days, left: Math.max(0, next.days - shown.current) }, badges,
  });
});
export default r;
