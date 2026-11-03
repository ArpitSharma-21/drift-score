import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import { weekStart } from '../services/scoring.js';
const r = Router();
r.use(auth);
r.get('/', async (req, res) => res.json(await Task.find({ user: req.userId }).sort({ dueDate: 1 })));
r.post('/', async (req, res) => {
  const { title, category, priority, dueDate } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'title and dueDate required' });
  res.json(await Task.create({ user: req.userId, title, category, priority, dueDate }));
});
// Demo data: 8 weeks of history that starts strong and slips from week 5 on.
r.post('/seed', async (req, res) => {
  const cats = ['dsa', 'assignment', 'project', 'study'];
  const prio = [3, 4, 2, 5];
  const titles = ['Solve 3 LeetCode mediums', 'DBMS assignment', 'Project milestone', 'Revise OS notes'];
  const masks = [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,0,1,0],[0,1,0,0],[0,0,1,0],[0,0,0,0]];
  const base = weekStart(new Date()); const docs = [];
  masks.forEach((mask, i) => mask.forEach((done, k) => {
    const due = new Date(base); due.setDate(due.getDate() - (8 - i) * 7 + k);
    const completedAt = done ? new Date(due.getTime() - 86400000) : undefined;
    docs.push({ user: req.userId, title: titles[k], category: cats[k], priority: prio[k], dueDate: due, completedAt, reminded: true });
  }));
  [1, 3, 6].forEach((d, k) => { const due = new Date(); due.setDate(due.getDate() + d); docs.push({ user: req.userId, title: titles[k] + ' (this week)', category: cats[k], priority: prio[k] + (k === 0 ? 1 : 0) > 5 ? 5 : prio[k], dueDate: due }); });
  await Task.insertMany(docs); res.json({ added: docs.length });
});
r.patch('/:id/complete', async (req, res) =>
  res.json(await Task.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { completedAt: new Date() }, { new: true })));
r.delete('/:id', async (req, res) => { await Task.deleteOne({ _id: req.params.id, user: req.userId }); res.json({ ok: true }); });
export default r;
