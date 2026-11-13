import test from 'node:test';
import assert from 'node:assert';
import { sampleTasks, SAMPLE_NOTE } from '../src/services/sample.js';
import { weeklyRates, driftScore, findDriftPoint, scoreTrend, buildReport } from '../src/services/scoring.js';
import { computeStreak, MILESTONES } from '../src/services/streak.js';
import { buildFacts } from '../src/services/recovery.js';
import { chunkText, rank } from '../src/services/rag.js';

// Friday 13 Nov 2026, 10:00 UTC. Checked for UTC, India (-330) and a US timezone (+300).
const now = new Date(Date.UTC(2026, 10, 13, 10));
for (const off of [0, -330, 300]) {
  test(`sample data tells the intended story (timezone offset ${off})`, () => {
    const tasks = sampleTasks({ now, offset: off });
    const weeks = weeklyRates(tasks, now);
    assert.ok(findDriftPoint(weeks), 'a drift point is found');
    assert.equal(scoreTrend(weeks).detected, true, 'the decline banner shows');
    assert.ok(['At Risk', 'Critical'].includes(driftScore(weeks, tasks, now).risk));
    const rep = buildReport(tasks, now);
    assert.ok(rep.weeks.length >= 8 && rep.months.length >= 2, 'weekly and monthly reports have content');
    const s = computeStreak(tasks.filter(t => t.completedAt).map(t => t.completedAt), off, now);
    assert.equal(s.current, 2); assert.equal(s.activeToday, true);
    assert.ok(s.best >= 21 && s.best < 30, `best streak ${s.best} earns badges 7, 14 and 21 but not 30`);
    const f = buildFacts(tasks, { now, offset: off });
    assert.equal(f.topics[0].topic, 'Binary Trees', 'Drift AI sees the weak topic');
    assert.ok(f.missed.length >= 5);
  });
}
test('every sample task is tagged, well formed, and kept out of reminders', () => {
  const tasks = sampleTasks({ now });
  assert.ok(tasks.length > 50);
  for (const t of tasks) { assert.equal(t.source, 'sample'); assert.equal(t.reminded, true); assert.ok(t.title && t.dueDate instanceof Date && t.priority >= 1 && t.priority <= 5); }
  assert.equal(MILESTONES[0].days, 7);
});
test('the sample note answers the question the demo suggests', () => {
  const chunks = chunkText(SAMPLE_NOTE).map(text => ({ text }));
  assert.match(rank('binary trees diameter level order', chunks, null, 1)[0].chunk.text, /Binary trees/);
});
