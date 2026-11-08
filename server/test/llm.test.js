import test from 'node:test';
import assert from 'node:assert';

test('a retired model name is replaced by one the provider still offers', async () => {
  process.env.GROQ_API_KEY = 'k'; process.env.GROQ_MODEL = 'retired-model'; delete process.env.GEMINI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const used = [];
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'whisper-large-v3' }, { id: 'openai/gpt-oss-20b' }, { id: 'llama-3.1-8b-instant' }] }) };
    const model = JSON.parse(init.body).model; used.push(model);
    return model === 'retired-model' ? { ok: false, status: 404, text: async () => 'model_not_found' } : { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }] }) };
  };
  const { generate } = await import('../src/services/llm.js');
  assert.equal(await generate('s', 'u'), 'hello');
  assert.deepEqual(used, ['retired-model', 'llama-3.1-8b-instant']);
  assert.equal(await generate('s', 'u'), 'hello'); // remembered, no second 404
  assert.equal(used.at(-1), 'llama-3.1-8b-instant'); assert.equal(used.length, 3);
});
test('when every provider fails the user gets a clear message', async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  const { generate } = await import('../src/services/llm.js');
  await assert.rejects(() => generate('s', 'u'), e => e.expose === true && /not responding/.test(e.message));
});
