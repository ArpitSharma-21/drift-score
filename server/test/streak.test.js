import test from 'node:test';
import assert from 'node:assert';
import { computeStreak, MILESTONES, dayKey } from '../src/services/streak.js';

const at = (m, d, h = 12) => new Date(Date.UTC(2026, m - 1, d, h));
const now = at(11, 10);

test('counts consecutive days ending today', () => {
  const s = computeStreak([at(11, 8), at(11, 9), at(11, 10)], 0, now);
  assert.deepEqual(s, { current: 3, best: 3, activeToday: true });
});
test('streak survives until the day ends', () => {
  const s = computeStreak([at(11, 8), at(11, 9)], 0, now);
  assert.equal(s.current, 2); assert.equal(s.activeToday, false);
});
test('a missed day resets current but keeps best', () => {
  const s = computeStreak([at(11, 1), at(11, 2), at(11, 3), at(11, 4), at(11, 9)], 0, now);
  assert.equal(s.current, 1); assert.equal(s.best, 4);
  assert.equal(computeStreak([at(11, 1), at(11, 2), at(11, 3)], 0, now).current, 0);
});
test('two tasks on one day count once', () => {
  assert.equal(computeStreak([at(11, 10, 8), at(11, 10, 15)], 0, now).best, 1);
});
test('uses the users own timezone (IST = -330)', () => {
  // 20:00 UTC on the 9th is 01:30 IST on the 10th
  assert.equal(dayKey(at(11, 9, 20), -330), '2026-11-10');
});
test('there are 10 milestones, the first at 7 days', () => {
  assert.equal(MILESTONES.length, 10); assert.equal(MILESTONES[0].days, 7);
});
