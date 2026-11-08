// Providers: Groq (free, fast), Gemini (free), Anthropic (paid). Whichever has a key is used,
// and if one fails the next one is tried. Set AI_PROVIDER to choose which goes first.
import { UserError } from './errors.js';
const j = res => res.text().then(t => t.slice(0, 200));
// Free-tier model names get retired often. If one 404s, ask the provider what it offers now and use that
// (remembered until the server restarts). The env vars still win while their model works.
const picked = {};
const prefer = (ids, patterns) => { for (const p of patterns) { const f = ids.find(x => p.test(x)); if (f) return f; } return ids[0] || null; };
const newest = ids => [...ids].sort((a, b) => parseFloat((b.match(/(\d+(\.\d+)?)/) || [0])[0]) - parseFloat((a.match(/(\d+(\.\d+)?)/) || [0])[0]));
const gone = (name, res, text) => Object.assign(new Error(`${name} ${res.status} ${text}`), { modelMissing: res.status === 404 });
const PROVIDERS = {
  groq: {
    key: () => process.env.GROQ_API_KEY,
    async call(system, user, o) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
        body: JSON.stringify({ model: picked.groq || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', max_tokens: o.maxTokens, temperature: o.json ? 0.2 : 0.4, ...(o.json ? { response_format: { type: 'json_object' } } : {}),
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) throw gone('Groq', res, await j(res));
      return (await res.json()).choices?.[0]?.message?.content || '';
    },
    async discover() {
      const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY } });
      if (!res.ok) return null;
      const ids = (await res.json()).data.map(m => m.id).filter(id => !/whisper|guard|tts|orpheus|embed|safeguard/i.test(id));
      return (picked.groq = prefer(ids, [/llama-3\.3-70b/, /llama-3\.1-8b/, /gpt-oss-120b/, /gpt-oss-20b/, /llama/, /qwen/]));
    },
  },
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    async call(system, user, o) {
      const model = picked.gemini || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: o.maxTokens, ...(o.json ? { responseMimeType: 'application/json' } : {}) } }),
      });
      if (!res.ok) throw gone('Gemini', res, await j(res));
      return ((await res.json()).candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    },
    async discover() {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
      if (!res.ok) return null;
      const ids = ((await res.json()).models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, '')).filter(id => /^gemini/.test(id) && !/embed|vision|tts|image|live|audio|robotics|computer/i.test(id));
      return (picked.gemini = prefer(newest(ids), [/flash-lite/, /flash/, /gemini/]));
    },
  },
  anthropic: {
    key: () => process.env.ANTHROPIC_API_KEY,
    async call(system, user, o) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: o.maxTokens, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error('Anthropic ' + res.status + ' ' + (await j(res)));
      return (await res.json()).content.map(b => b.text || '').join('\n');
    },
  },
};
export const available = () => [process.env.AI_PROVIDER, 'groq', 'gemini', 'anthropic']
  .filter((p, i, a) => p && PROVIDERS[p] && a.indexOf(p) === i && PROVIDERS[p].key());

export async function generate(system, user, opts = {}) {
  const o = { maxTokens: 600, json: false, ...opts };
  for (const p of available()) {
    try { return await PROVIDERS[p].call(system, user, o); }
    catch (e) {
      console.error('[ai]', e.message);
      if (e.modelMissing && PROVIDERS[p].discover) {
        try {
          const m = await PROVIDERS[p].discover();
          if (m) { console.error(`[ai] ${p}: switching to model ${m}`); return await PROVIDERS[p].call(system, user, o); }
        } catch (e2) { console.error('[ai]', e2.message); }
      }
    }
  }
  throw new UserError('The AI service is not responding right now. Please try again in a minute.', 502);
}
