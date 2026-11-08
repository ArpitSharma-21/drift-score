import test from 'node:test';
import assert from 'node:assert';
import { chunkText, rank, keywordScores, cosine, tokenize } from '../src/services/rag.js';
import { buildFacts, validatePlan, makePlan, parseJson } from '../src/services/recovery.js';
import { scoreTrend } from '../src/services/scoring.js';

const now = new Date(Date.UTC(2026, 10, 10, 12));
const day = n => new Date(now.getTime() - n * 864e5);
const task = (o) => ({ title: 't', category: 'dsa', priority: 3, topic: '', ...o });

test('chunker keeps pieces under the size and loses no text', () => {
  const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} about trees and graphs and arrays.`).join('\n\n');
  const chunks = chunkText(text, 300);
  assert.ok(chunks.length > 3); assert.ok(chunks.every(c => c.length <= 300));
  assert.ok(chunks.join(' ').includes('Paragraph 29'));
});
test('keyword search finds the right chunk', () => {
  const chunks = [{ text: 'Week 1: arrays and two pointers, sliding window practice.' }, { text: 'Week 2: binary tree traversal, height and diameter, level order.' }, { text: 'DBMS: normalisation and joins.' }];
  assert.equal(rank('binary tree diameter', chunks, null, 1)[0].chunk, chunks[1]);
  assert.equal(rank('normalization joins dbms', chunks, null, 1)[0].chunk, chunks[2]);
});
test('meaning search uses vectors when both sides have them', () => {
  const chunks = [{ text: 'alpha', embedding: [1, 0] }, { text: 'beta', embedding: [0, 1] }];
  const hit = rank('zzz', chunks, [0.1, 0.9], 1)[0];
  assert.equal(hit.chunk.text, 'beta'); assert.equal(hit.mode, 'meaning');
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
});
test('stop words are ignored', () => assert.deepEqual(tokenize('Why am I weak in the Trees?'), ['am', 'weak', 'trees']));

test('score trend notices a decline', () => {
  const weeks = [90, 92, 88, 90, 40, 30].map((rate, i) => ({ week: 'w' + i, rate }));
  const t = scoreTrend(weeks); assert.equal(t.detected, true); assert.ok(t.drop >= 15);
  assert.equal(scoreTrend([80, 82, 79, 81].map(rate => ({ rate }))).detected, false);
});
test('facts rank the weakest topic first and ignore future tasks', () => {
  const tasks = [
    task({ topic: 'Arrays', dueDate: day(10), completedAt: day(9) }), task({ topic: 'Arrays', dueDate: day(9), completedAt: day(9) }),
    task({ topic: 'Binary Trees', dueDate: day(8) }), task({ topic: 'Binary Trees', dueDate: day(7), completedAt: day(2) }),
    task({ topic: 'Graphs', dueDate: new Date(now.getTime() + 5 * 864e5) }),
  ];
  const f = buildFacts(tasks, { now });
  assert.equal(f.topics[0].topic, 'Binary Trees'); assert.equal(f.topics.some(t => t.topic === 'Graphs'), false);
  assert.equal(f.missed.length, 1);
});
test('plan validation clamps, dedupes and caps the AI output', () => {
  const raw = { summary: 'x'.repeat(900), causes: new Array(9).fill({ text: 'c', evidence: 'e' }), plan: [
    { day: 1, title: 'Tree traversals', category: 'dsa', priority: 5 }, { day: 1, title: 'tree traversals', priority: 4 },
    { day: 1, title: 'A', priority: 2 }, { day: 1, title: 'B', priority: 1 }, { day: 1, title: 'C', priority: 3 },
    { day: 9, title: 'Out of range' }, { day: 2, title: 'Already pending' }, { day: 2, title: 'Bad fields', category: 'hacking', priority: 99 }, { title: 'No day' } ] };
  const v = validatePlan(raw, { maxPerDay: 2, existing: ['already pending'] });
  assert.equal(v.summary.length, 400); assert.equal(v.causes.length, 4);
  assert.equal(v.items.filter(i => i.day === 1).length, 2); assert.equal(v.items[0].title, 'Tree traversals');
  const bad = v.items.find(i => i.title === 'Bad fields'); assert.equal(bad.category, 'study'); assert.equal(bad.priority, 3);
  assert.ok(!v.items.some(i => ['Out of range', 'Already pending'].includes(i.title)));
  assert.ok(v.items.find(i => i.title === 'No day').day >= 1); // a missing day is filled in, not dropped
});
test('makePlan works end to end with a fake model, and rejects junk output', async () => {
  const facts = buildFacts([task({ topic: 'Binary Trees', dueDate: day(5) })], { now });
  const good = '```json\n' + JSON.stringify({ summary: 's', causes: [{ text: 'Trees untouched', evidence: 'Binary Trees: 0 of 1' }], plan: [{ day: 1, title: 'Tree traversals', category: 'dsa', topic: 'Binary Trees', priority: 5 }] }) + '\n```';
  const p = await makePlan({ facts, notes: [{ title: 'Roadmap', text: 'trees' }], focus: '', existing: [], llm: async () => good });
  assert.equal(p.items.length, 1);
  await assert.rejects(() => makePlan({ facts, notes: [], focus: '', existing: [], llm: async () => 'sorry, I cannot do that' }), /usable plan this time/);
  await assert.rejects(() => makePlan({ facts, notes: [], focus: '', existing: [], llm: async () => '{"plan":[]}' }), /usable plan this time/);
  assert.equal(parseJson('noise {"a":1} noise').a, 1);
});

test('accepts the other plan shapes models tend to return', () => {
  const a = validatePlan({ plan: { 'Day 1': ['Trees intro'], 'Day 2': [{ title: 'Diameter', priority: 'high' }] } });
  assert.deepEqual(a.items.map(i => [i.day, i.title, i.priority]), [[1, 'Trees intro', 3], [2, 'Diameter', 4]]);
  const b = validatePlan({ tasks: [{ task: 'Level order', day: 'Day 3', priority: 'low' }] });
  assert.deepEqual(b.items.map(i => [i.day, i.title, i.priority]), [[3, 'Level order', 2]]);
  const c = validatePlan({ plan: [{ day: 1, tasks: ['A1', 'B1'] }, { day: 2, tasks: ['C1'] }] });
  assert.equal(c.items.length, 3);
  const d = validatePlan({ plan: ['One', 'Two', 'Three', 'Four'] }, { maxPerDay: 2 });
  assert.deepEqual(d.items.map(i => i.day), [1, 1, 2, 2]);
});
test('retries once when the first reply is unusable', async () => {
  const facts = buildFacts([task({ topic: 'Trees', dueDate: day(5) })], { now });
  let calls = 0;
  const llm = async () => (++calls === 1 ? 'Sure! Here is your plan...' : JSON.stringify({ plan: [{ day: 1, title: 'Tree traversals' }] }));
  const p = await makePlan({ facts, notes: [], focus: '', existing: [], llm });
  assert.equal(calls, 2); assert.equal(p.items.length, 1);
});
