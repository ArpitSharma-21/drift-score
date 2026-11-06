import webpush from 'web-push';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import PushSub from '../models/PushSub.js';

export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const emailReady = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let vapidSet = false;
let mailer = null;
const getMailer = () => mailer ||= nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });

export async function sendPush(userId, payload) {
  if (!pushReady()) return 0;
  if (!vapidSet) { webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:' + (process.env.SMTP_USER || 'admin@example.com'), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY); vapidSet = true; }
  let sent = 0;
  for (const s of await PushSub.find({ user: userId })) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 3600 }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await PushSub.deleteOne({ _id: s._id }); // device unsubscribed
      else console.error('[push]', e.statusCode || e.message);
    }
  }
  return sent;
}

export const unsubToken = userId => jwt.sign({ id: String(userId), p: 'unsub' }, process.env.JWT_SECRET, { expiresIn: '365d' });

export async function sendEmail(user, text) {
  if (!emailReady()) return false;
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  const stop = `${base}/api/nudges/unsubscribe?token=${unsubToken(user._id)}`;
  await getMailer().sendMail({
    from: `Drift Score <${process.env.SMTP_USER}>`, to: user.email, subject: 'Drift Score',
    text: `${text}\n\nOpen Drift Score: ${base}\nStop these emails: ${stop}`,
    html: `<p style="font:600 18px system-ui,sans-serif;max-width:480px">${esc(text)}</p><p><a href="${base}">Open Drift Score</a></p><p style="font:13px system-ui,sans-serif;color:#6a7480"><a href="${stop}">Stop these emails</a></p>`,
  });
  return true;
}
