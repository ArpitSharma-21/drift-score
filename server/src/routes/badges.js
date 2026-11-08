import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { MILESTONES, computeStreak } from '../services/streak.js';
const r = Router();

r.get('/', auth, async (req, res) => {
  const [tasks, user] = await Promise.all([
    Task.find({ user: req.userId, completedAt: { $ne: null } }).select('completedAt'),
    User.findById(req.userId),
  ]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const off = parseInt(req.headers['x-tz'], 10) || 0;
  const s = computeStreak(tasks.map(t => t.completedAt), off);
  const best = Math.max(user.bestStreak || 0, s.best); // earned badges never get taken away
  const have = new Map((user.badges || []).map(b => [b.id, b.earnedAt]));
  const fresh = [];
  for (const m of MILESTONES) if (best >= m.days && !have.has(m.id)) { have.set(m.id, new Date()); fresh.push(m.id); }
  if (fresh.length || best !== (user.bestStreak || 0)) {
    user.bestStreak = best; user.badges = [...have].map(([id, earnedAt]) => ({ id, earnedAt })); await user.save();
  }
  const next = MILESTONES.find(m => !have.has(m.id));
  res.json({
    current: s.current, best, activeToday: s.activeToday, fresh,
    next: next && { id: next.id, days: next.days, left: Math.max(0, next.days - s.current) },
    badges: MILESTONES.map(m => ({ ...m, earned: have.has(m.id), earnedAt: have.get(m.id) || null })),
  });
});
export default r;
