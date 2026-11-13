import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import PushSub from '../models/PushSub.js';
import { NUDGES, pickNudge, stateFor } from '../services/nudges.js';
import { dayKey } from '../services/streak.js';
import { pushReady, emailReady, sendPush, sendEmail } from '../services/notify.js';
const r = Router();
const HOURS = [8, 13, 19, 21];

const tzOf = req => { const n = parseInt(req.headers['x-tz'], 10); return Number.isFinite(n) ? n : 0; };

// Today's message for a user. Chosen once per local day and remembered, so the app, push and email all agree.
export async function todaysNudge(user, tasks, off, now = new Date()) {
  const today = dayKey(now, off);
  if (user.nudge?.lastDay === today) { const n = NUDGES.find(x => x.id === user.nudge.lastId); if (n) return n; }
  const n = pickNudge(stateFor(tasks, off, now).state, user.nudge?.lastId);
  user.set('nudge.lastDay', today); user.set('nudge.lastId', n.id); await user.save();
  return n;
}

r.get('/today', auth, async (req, res) => {
  const [user, tasks] = await Promise.all([User.findById(req.userId), Task.find({ user: req.userId, source: { $ne: 'sample' } }).select('completedAt dueDate')]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const off = tzOf(req);
  if (user.tz !== off) user.tz = off;
  const n = await todaysNudge(user, tasks, off);
  res.json({ id: n.id, text: n.text });
});

const settings = async userId => {
  const [user, subs] = await Promise.all([User.findById(userId), PushSub.countDocuments({ user: userId })]);
  if (!user) return null;
  return { email: !!user.nudge?.email, hour: user.nudge?.hour ?? 19, pushSubscribed: subs > 0, pushReady: pushReady(), emailReady: emailReady(), vapidKey: process.env.VAPID_PUBLIC_KEY || null, hours: HOURS };
};
r.get('/settings', auth, async (req, res) => { const s = await settings(req.userId); if (!s) return res.status(401).json({ error: 'Unauthorized' }); res.json(s); });
r.put('/settings', auth, async (req, res) => {
  const user = await User.findById(req.userId), { email, hour } = req.body || {};
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (typeof email === 'boolean') user.set('nudge.email', email);
  if (HOURS.includes(hour)) user.set('nudge.hour', hour);
  user.tz = tzOf(req); await user.save();
  res.json(await settings(req.userId));
});

r.post('/subscribe', auth, async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({ error: 'Invalid subscription' });
  await PushSub.findOneAndUpdate({ endpoint: sub.endpoint }, { user: req.userId, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, { upsert: true });
  await User.updateOne({ _id: req.userId }, { tz: tzOf(req) });
  res.json({ ok: true });
});
r.delete('/subscribe', auth, async (req, res) => { await PushSub.deleteOne({ user: req.userId, endpoint: req.body?.endpoint }); res.json({ ok: true }); });

// Sends today's message right now to whatever the user has switched on, so they can check it works.
r.post('/test', auth, rateLimit({ windowMs: 3600e3, max: 5 }), async (req, res) => {
  const [user, tasks] = await Promise.all([User.findById(req.userId), Task.find({ user: req.userId, source: { $ne: 'sample' } }).select('completedAt dueDate')]);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const n = await todaysNudge(user, tasks, tzOf(req));
  const push = await sendPush(user._id, { title: 'Drift Score', body: n.text, url: '/' });
  let email = false;
  if (user.nudge?.email) { try { email = await sendEmail(user, n.text); } catch (e) { console.error('[email]', e.message); } }
  res.json({ push, email, text: n.text });
});

// Link at the bottom of every email.
r.get('/unsubscribe', async (req, res) => {
  try {
    const t = jwt.verify(String(req.query.token || ''), process.env.JWT_SECRET);
    if (t.p !== 'unsub') throw new Error('bad token');
    await User.updateOne({ _id: t.id }, { 'nudge.email': false });
    res.send('<body style="font:18px system-ui;max-width:480px;margin:15vh auto;padding:0 20px"><b>You are unsubscribed.</b><p>Drift Score will not email you any more nudges. You can turn them back on in the app.</p></body>');
  } catch { res.status(400).send('This link is invalid or has expired.'); }
});
export default r;
