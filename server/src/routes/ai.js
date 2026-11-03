import { Router } from 'express';
import auth from '../middleware/auth.js';
import Task from '../models/Task.js';
import { weeklyRates, driftScore, findDriftPoint, buildReport } from '../services/scoring.js';
const r = Router();

// Providers: Groq (free, fast), Gemini (free), Anthropic (paid). Whichever has a key is used,
// and if one fails the next one is tried. Set AI_PROVIDER to choose which goes first.
const j = res => res.text().then(t => t.slice(0, 200));
const PROVIDERS = {
  groq: {
    key: () => process.env.GROQ_API_KEY,
    async call(system, user) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
        body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', max_tokens: 600, temperature: 0.4,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error('Groq ' + res.status + ' ' + (await j(res)));
      return (await res.json()).choices?.[0]?.message?.content || '';
    },
  },
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    async call(system, user) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 700 } }),
      });
      if (!res.ok) throw new Error('Gemini ' + res.status + ' ' + (await j(res)));
      return ((await res.json()).candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    },
  },
  anthropic: {
    key: () => process.env.ANTHROPIC_API_KEY,
    async call(system, user) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error('Anthropic ' + res.status + ' ' + (await j(res)));
      return (await res.json()).content.map(b => b.text || '').join('\n');
    },
  },
};
const available = () => [process.env.AI_PROVIDER, 'groq', 'gemini', 'anthropic']
  .filter((p, i, a) => p && PROVIDERS[p] && a.indexOf(p) === i && PROVIDERS[p].key());

async function generate(system, user) {
  let last;
  for (const p of available()) {
    try { return await PROVIDERS[p].call(system, user); } catch (e) { console.error('[ai]', e.message); last = e; }
  }
  throw last;
}

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