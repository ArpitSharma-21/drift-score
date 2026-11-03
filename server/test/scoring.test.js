import test from 'node:test';
import assert from 'node:assert';
import { weeklyRates, driftScore, findDriftPoint, buildReport, statusOf } from '../src/services/scoring.js';

const now = new Date(2026, 5, 30);
const task = (day, priority, done, category = 'dsa') => ({ title: 't' + day, category, priority,
  dueDate: new Date(2026, 5, day), completedAt: done === true ? new Date(2026, 5, day, 10) : done || undefined });

test('weights completion by priority', () => {
  const w = weeklyRates([task(8, 4, true), task(9, 1, false)], now);
  assert.equal(w[0].rate, 80);
});
test('late completion earns half credit', () => {
  const w = weeklyRates([task(8, 2, new Date(2026, 5, 10))], now);
  assert.equal(w[0].rate, 50);
});
test('tasks not yet due are ignored', () => {
  assert.equal(weeklyRates([new Date(2026, 6, 20)].map(d => ({ title: 'x', category: 'a', priority: 3, dueDate: d })), now).length, 0);
});
test('risk levels', () => {
  const weeks = [{ rate: 100 }, { rate: 100 }];
  assert.equal(driftScore(weeks, [], now).risk, 'Safe');
  assert.equal(driftScore([{ rate: 20 }], [], now).risk, 'Critical');
});
test('finds the week the drift began', () => {
  const rates = [100, 100, 100, 40, 30, 20].map((rate, i) => ({ week: 'w' + i, rate }));
  assert.equal(findDriftPoint(rates), 'w3');
  assert.equal(findDriftPoint([100, 95, 100, 90].map((rate, i) => ({ week: 'w' + i, rate }))), null);
});
test('report groups weeks into months with status', () => {
  const r = buildReport([task(1, 3, true), task(8, 3, false), task(15, 3, true)], now);
  assert.equal(r.weeks.length, 3);
  assert.equal(r.weeks[1].status, 'Missed');
  assert.equal(r.months.length, 1);
  assert.equal(statusOf(r.months[0].rate), r.months[0].status);
});
