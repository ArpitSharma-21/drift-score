import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
const r = Router();
r.use(auth);
r.get('/', async (req, res) => res.json(await Task.find({ user: req.userId }).sort({ dueDate: 1 })));
r.post('/', async (req, res) => {
  const { title, category, priority, dueDate } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'title and dueDate required' });
  res.json(await Task.create({ user: req.userId, title, category, priority, dueDate }));
});
r.delete('/', async (req, res) => { await Task.deleteMany({ user: req.userId }); res.json({ ok: true }); }); // start over
r.patch('/:id/complete', async (req, res) =>
  res.json(await Task.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { completedAt: new Date() }, { new: true })));
r.delete('/:id', async (req, res) => { await Task.deleteOne({ _id: req.params.id, user: req.userId }); res.json({ ok: true }); });
export default r;
