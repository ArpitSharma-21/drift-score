import { Router } from 'express';
import auth from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import Task from '../models/Task.js';
import Doc from '../models/Doc.js';
import Chunk from '../models/Chunk.js';
import RecoveryPlan from '../models/RecoveryPlan.js';
import { sampleTasks, SAMPLE_NOTE } from '../services/sample.js';
import { chunkText, embedDocs } from '../services/rag.js';
const r = Router();
r.use(auth);
const tzOf = req => { const n = parseInt(req.headers['x-tz'], 10); return Number.isFinite(n) ? n : 0; };

// Everything created for the demo is tagged, so removing it never touches the user's own data.
async function removeDemo(userId) {
  const planIds = (await RecoveryPlan.find({ user: userId, demo: true }).select('_id')).map(p => p._id);
  const t = await Task.deleteMany({ user: userId, $or: [{ source: 'sample' }, { planId: { $in: planIds } }] });
  await RecoveryPlan.deleteMany({ user: userId, demo: true });
  const docIds = (await Doc.find({ user: userId, sample: true }).select('_id')).map(d => d._id);
  await Chunk.deleteMany({ user: userId, doc: { $in: docIds } });
  await Doc.deleteMany({ user: userId, sample: true });
  return t.deletedCount;
}

// These two must stay above the '/:id' routes below.
r.post('/sample', rateLimit({ windowMs: 3600e3, max: 10, keyGenerator: req => String(req.userId), message: { error: 'Too many tries. Please wait a while.' } }), async (req, res) => {
  if (await Task.exists({ user: req.userId, source: 'sample' })) return res.status(409).json({ error: 'Sample data is already loaded.' });
  if (await Task.exists({ user: req.userId, source: { $ne: 'sample' } })) return res.status(400).json({ error: 'Sample data can only be added to an empty account, so it never mixes with your own tasks. Use Clear all my tasks first if you want to try it.' });
  const docs = sampleTasks({ offset: tzOf(req) }).map(t => ({ ...t, user: req.userId }));
  await Task.insertMany(docs);
  if (!(await Doc.exists({ user: req.userId, sample: true })) && (await Doc.countDocuments({ user: req.userId })) < 10) { // a note for Drift AI to search
    const pieces = chunkText(SAMPLE_NOTE); let vecs = null;
    try { vecs = await embedDocs(pieces); } catch (e) { console.error('[embed]', e.message); }
    const doc = await Doc.create({ user: req.userId, title: 'Sample study plan', sample: true, chars: SAMPLE_NOTE.length, chunkCount: pieces.length, mode: vecs ? 'meaning' : 'keyword' });
    await Chunk.insertMany(pieces.map((text, i) => ({ user: req.userId, doc: doc._id, idx: i, text, embedding: vecs ? vecs[i] : undefined })));
  }
  res.json({ tasks: docs.length });
});
r.delete('/sample', async (req, res) => res.json({ removed: await removeDemo(req.userId) }));
r.get('/', async (req, res) => res.json(await Task.find({ user: req.userId }).sort({ dueDate: 1 })));
r.post('/', async (req, res) => {
  const { title, category, priority, dueDate, topic } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'title and dueDate required' });
  res.json(await Task.create({ user: req.userId, title: String(title).trim().slice(0, 200), category: String(category || 'general').slice(0, 20), priority, dueDate, topic: String(topic || '').trim().slice(0, 40) }));
});
r.delete('/', async (req, res) => { await Task.deleteMany({ user: req.userId }); await removeDemo(req.userId); res.json({ ok: true }); }); // start over
r.patch('/:id/complete', async (req, res) =>
  res.json(await Task.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { completedAt: new Date() }, { new: true })));
r.delete('/:id', async (req, res) => { await Task.deleteOne({ _id: req.params.id, user: req.userId }); res.json({ ok: true }); });
export default r;
