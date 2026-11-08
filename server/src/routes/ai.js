import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import { weeklyRates, driftScore, findDriftPoint, buildReport } from '../services/scoring.js';
import { generate, available } from '../services/llm.js';
const r = Router();

const SYSTEM = 'You are a direct, supportive study coach for a college student. Use ONLY the stats given. Explain what happened, which category slipped first, and give a concrete plan for the next week in under 150 words. No fluff, no markdown headings.';

r.post('/coach', auth, async (req, res) => {
  if (!available().length) return res.status(503).json({ error: 'AI key missing. Add GROQ_API_KEY (free, console.groq.com) or GEMINI_API_KEY to the server environment.' });
  try {
    const tasks = await Task.find({ user: req.userId });
    const all = weeklyRates(tasks);
    const rep = buildReport(tasks);
    const { period, key } = req.body || {};
    const focus = period === 'week' ? rep.weeks.find(w => w.week === key) : period === 'month' ? rep.months.find(m => m.month === key) : null;
    const facts = { ...driftScore(all, tasks), driftPoint: findDriftPoint(all),
      focus: focus ? { period, ...focus, weeks: undefined } : undefined,
      recentWeeks: rep.weeks.slice(-8).map(({ week, rate, delta, worst, best }) => ({ week, rate, delta, worst, best })) };
    res.json({ advice: await generate(SYSTEM, JSON.stringify(facts)) });
  } catch (e) { console.error(e.message); res.status(500).json({ error: 'The AI service is busy or the key is invalid. Please try again in a minute.' }); }
});
export default r;
