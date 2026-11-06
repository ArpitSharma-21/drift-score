import test from 'node:test';
import assert from 'node:assert';
import { NUDGES, pickNudge, stateFor } from '../src/services/nudges.js';

const now = new Date(Date.UTC(2026, 10, 10, 12));
const day = n => new Date(now.getTime() - n * 864e5);

test('there are 30 unique messages, 10 in each group', () => {
  assert.equal(NUDGES.length, 30);
  assert.equal(new Set(NUDGES.map(n => n.id)).size, 30);
  for (const p of ['sv', 'fl', 'rn']) assert.equal(NUDGES.filter(n => n.id.startsWith(p)).length, 10);
});
test('a new user only gets messages that fit anyone', () => {
  for (let i = 0; i < 50; i++) assert.ok(pickNudge({}, null).when.includes('any'));
});
test('overdue tasks make roast messages possible', () => {
  const seen = new Set(Array.from({ length: 300 }, () => pickNudge({ behind: true }, null).id));
  assert.ok(seen.has('sv1'));
});
test('never repeats yesterday message when another fits', () => {
  for (let i = 0; i < 100; i++) assert.notEqual(pickNudge({}, 'rn1').id, 'rn1');
});
test('state: overdue and inactive', () => {
  const tasks = [{ dueDate: day(10), completedAt: day(6) }, { dueDate: day(3) }];
  const { state, activeToday } = stateFor(tasks, 0, now);
  assert.equal(state.behind, true); assert.equal(state.inactive, true); assert.equal(activeToday, false);
});
test('state: streak and done today', () => {
  const tasks = [0, 1, 2, 3].map(i => ({ dueDate: day(i), completedAt: day(i) }));
  const { state, activeToday } = stateFor(tasks, 0, now);
  assert.equal(state.streak, true); assert.equal(activeToday, true); assert.equal(state.inactive, false);
});
test('state: running streak but nothing yet today', () => {
  const tasks = [1, 2].map(i => ({ dueDate: day(i), completedAt: day(i) }));
  assert.equal(stateFor(tasks, 0, now).state.yesterday, true);
});
