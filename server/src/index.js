import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import auth from './routes/auth.js';
import tasks from './routes/tasks.js';
import stats from './routes/stats.js';
import ai from './routes/ai.js';
import badges from './routes/badges.js';
import nudges from './routes/nudges.js';
import cron from './routes/cron.js';
import { startReminders } from './services/reminders.js';

const app = express();
app.set('trust proxy', 1); // needed behind Render/Vercel proxies so rate limiting sees real IPs
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());
app.use('/api/auth', auth);
app.use('/api/tasks', tasks);
app.use('/api/stats', stats);
app.use('/api/badges', badges);
app.use('/api/nudges', nudges);
app.use('/api/cron', cron);
app.use('/api/ai', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), ai); // protect your API credits

// In production the server also serves the built React app (one deployment, no CORS issues).
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

await mongoose.connect(process.env.MONGO_URI);
startReminders();
app.listen(process.env.PORT || 5000, () => console.log('API running'));
