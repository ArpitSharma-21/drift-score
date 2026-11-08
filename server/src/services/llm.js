// Providers: Groq (free, fast), Gemini (free), Anthropic (paid). Whichever has a key is used,
// and if one fails the next one is tried. Set AI_PROVIDER to choose which goes first.
const j = res => res.text().then(t => t.slice(0, 200));
const PROVIDERS = {
  groq: {
    key: () => process.env.GROQ_API_KEY,
    async call(system, user, o) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
        body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', max_tokens: o.maxTokens, temperature: o.json ? 0.2 : 0.4, ...(o.json ? { response_format: { type: 'json_object' } } : {}),
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error('Groq ' + res.status + ' ' + (await j(res)));
      return (await res.json()).choices?.[0]?.message?.content || '';
    },
  },
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    async call(system, user, o) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: o.maxTokens, ...(o.json ? { responseMimeType: 'application/json' } : {}) } }),
      });
      if (!res.ok) throw new Error('Gemini ' + res.status + ' ' + (await j(res)));
      return ((await res.json()).candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
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
  let last;
  for (const p of available()) {
    try { return await PROVIDERS[p].call(system, user, o); } catch (e) { console.error('[ai]', e.message); last = e; }
  }
  throw last;
}

