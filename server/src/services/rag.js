// Retrieval over a user's own study material. Works with embeddings (meaning search) and falls back to keywords.
const STOP = new Set('a an the and or of to in on for with is are was were be been it this that these those i my me we you your at by from as but not do does did how why what which who when where can could should would about into over than then so if'.split(' '));
export const tokenize = s => (String(s).toLowerCase().match(/[a-z0-9+#.]+/g) || []).map(w => w.replace(/^\.+|\.+$/g, '')).filter(w => w.length > 1 && !STOP.has(w));

export function chunkText(text, size = 700, overlap = 100) {
  const clean = String(text).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const paras = clean.split(/\n{2,}|\n(?=[-*#]|\d+[.)])/).map(p => p.trim()).filter(Boolean);
  const out = []; let cur = '';
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const p of paras) {
    if (p.length > size) { flush(); for (let i = 0; i < p.length; i += size - overlap) out.push(p.slice(i, i + size).trim()); continue; }
    if ((cur + '\n' + p).length > size) { flush(); cur = p; } else cur = cur ? cur + '\n' + p : p;
  }
  flush(); return out;
}

// BM25-style keyword scores, one per text.
export function keywordScores(query, texts) {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !texts.length) return texts.map(() => 0);
  const docs = texts.map(tokenize), N = docs.length, avg = docs.reduce((s, d) => s + d.length, 0) / N || 1, df = {};
  for (const d of docs) for (const w of new Set(d)) df[w] = (df[w] || 0) + 1;
  return docs.map(d => {
    const tf = {}; d.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
    let s = 0;
    for (const w of q) { const f = tf[w]; if (!f) continue; const idf = Math.log(1 + (N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.length / avg)); }
    return s;
  });
}
export const cosine = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return x && y ? d / Math.sqrt(x * y) : 0; };

// chunks: [{ text, embedding? }]. Uses meaning + keywords when both sides have vectors, keywords otherwise.
export function rank(query, chunks, qvec = null, k = 5) {
  const kw = keywordScores(query, chunks.map(c => c.text)), top = Math.max(...kw, 1e-9);
  return chunks.map((c, i) => {
    const sem = qvec && c.embedding && c.embedding.length === qvec.length ? cosine(qvec, c.embedding) : null;
    const k1 = kw[i] / top;
    return { chunk: c, mode: sem == null ? 'keyword' : 'meaning', score: sem == null ? k1 : 0.7 * Math.max(sem, 0) + 0.3 * k1 };
  }).filter(s => s.score > 0.05).sort((a, b) => b.score - a.score).slice(0, k);
}

// ---- Gemini embeddings (free tier). The model name changes over time, so it is an env var. ----
const model = () => process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const DIM = 256;
const call = async (method, body) => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model()}:${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('embedding ' + res.status);
  return res.json();
};
export async function embedDocs(texts) {
  if (!process.env.GEMINI_API_KEY) return null;
  const out = [];
  for (let i = 0; i < texts.length; i += 50) {
    const d = await call('batchEmbedContents', { requests: texts.slice(i, i + 50).map(t => ({ model: `models/${model()}`, content: { parts: [{ text: t }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: DIM })) });
    out.push(...d.embeddings.map(e => e.values));
  }
  return out;
}
export async function embedQuery(text) {
  if (!process.env.GEMINI_API_KEY) return null;
  const d = await call('embedContent', { model: `models/${model()}`, content: { parts: [{ text }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: DIM });
  return d.embedding.values;
}
