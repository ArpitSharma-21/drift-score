import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Task from '../models/Task.js';

// Email via any SMTP (Gmail app password works). Without SMTP vars, reminders are logged to the console.
const mailer = process.env.SMTP_USER
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
  : null;

export function startReminders() {
  cron.schedule('0 * * * *', async () => {
    const soon = new Date(Date.now() + 24 * 3600 * 1000);
    const due = await Task.find({ completedAt: null, reminded: false, dueDate: { $lte: soon } }).populate('user', 'email name nudge');
    for (const t of due) {
      if (!t.user?.nudge?.email) continue; // only people who opted in to emails
      const text = `Reminder: "${t.title}" (priority ${t.priority}) is due ${t.dueDate.toDateString()}.`;
      try {
        if (mailer) await mailer.sendMail({ from: process.env.SMTP_USER, to: t.user.email, subject: 'Drift Score reminder', text });
        else console.log('[reminder]', t.user.email, text);
        t.reminded = true; await t.save();
      } catch (e) { console.error('reminder failed', e.message); }
    }
  });
}
