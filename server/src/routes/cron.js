import { Router } from 'express';
import User from '../models/User.js';
import Task from '../models/Task.js';
import PushSub from '../models/PushSub.js';
import { stateFor } from '../services/nudges.js';
import { dayKey } from '../services/streak.js';
import { todaysNudge } from './nudges.js';
import { sendPush, sendEmail } from '../services/notify.js';
const r = Router();

// Call this every ~10 minutes from a free scheduler (cron-job.org). It also keeps the free Render server awake.
// Each user gets at most one nudge a day, at their chosen local hour (or up to 2 hours later if a call was missed),
// and only if they have not finished a task yet today.
r.get('/nudges', async (req, res) => {
  if (!process.env.CRON_SECRET || req.query.key !== process.env.CRON_SECRET) return res.status(403).json({ error: 'forbidden' });
  const now = new Date();
  const subUsers = await PushSub.distinct('user');
  const users = await User.find({ $or: [{ 'nudge.email': true }, { _id: { $in: subUsers } }] });
  let sent = 0;
  for (const u of users) {
    const off = u.tz || 0, today = dayKey(now, off), target = u.nudge?.hour ?? 19;
    const hour = new Date(now.getTime() - off * 60000).getUTCHours();
    if (hour < target || hour > target + 2 || u.nudge?.sentDay === today) continue;
    const tasks = await Task.find({ user: u._id }).select('completedAt dueDate');
    if (stateFor(tasks, off, now).activeToday) continue;
    const n = await todaysNudge(u, tasks, off, now);
    const pushed = await sendPush(u._id, { title: 'Drift Score', body: n.text, url: '/' });
    let mailed = false;
    if (u.nudge?.email) { try { mailed = await sendEmail(u, n.text); } catch (e) { console.error('[email]', e.message); } }
    if (pushed || mailed) { u.set('nudge.sentDay', today); await u.save(); sent++; }
  }
  res.json({ checked: users.length, sent });
});
export default r;
