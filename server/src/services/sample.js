// A made-up student whose studies started to drift, built so every feature has something to show:
// a long streak early on (badges + heatmap), a clear drop from week 5 (score, drift point, reports),
// weak topics (Drift AI), and two demo notes (search over study material).
import { dayKey } from './streak.js';
const DAY = 864e5;

// [title, category, topic, priority, done]  per week, oldest first. Weeks 1 to 4 go well, then Binary Trees and the heavy tasks slip.
const WEEKS = [
  [['Solve 5 array problems', 'dsa', 'Arrays', 3, 1], ['DBMS ER diagram assignment', 'assignment', 'DBMS', 4, 1], ['Mini project: set up repo', 'project', 'Mini project', 2, 1], ['Revise OS processes', 'study', 'OS', 5, 1]],
  [['Two pointers practice', 'dsa', 'Arrays', 3, 1], ['DBMS normalisation worksheet', 'assignment', 'DBMS', 4, 1], ['Mini project: login page', 'project', 'Mini project', 2, 1], ['Revise OS scheduling', 'study', 'OS', 5, 1]],
  [['Linked list basics', 'dsa', 'Linked Lists', 3, 1], ['DBMS SQL joins lab', 'assignment', 'DBMS', 4, 1], ['Mini project: tasks API', 'project', 'Mini project', 2, 1], ['Revise OS memory management', 'study', 'OS', 5, 1]],
  [['Stacks and queues problems', 'dsa', 'Stacks', 3, 1], ['OS scheduler simulation', 'assignment', 'OS', 4, 1], ['Mini project: dashboard', 'project', 'Mini project', 2, 1], ['Revise DBMS transactions', 'study', 'DBMS', 5, 1]],
  [['Binary tree traversals', 'dsa', 'Binary Trees', 3, 0], ['DBMS indexing assignment', 'assignment', 'DBMS', 4, 1], ['Mini project: charts', 'project', 'Mini project', 2, 1], ['Revise OS deadlocks', 'study', 'OS', 5, 0]],
  [['Height and diameter of a tree', 'dsa', 'Binary Trees', 3, 0], ['OS paging assignment', 'assignment', 'OS', 4, 0], ['Mini project: notifications', 'project', 'Mini project', 2, 2], ['Revise DBMS indexing', 'study', 'DBMS', 5, 0]],
  [['Level order traversal', 'dsa', 'Binary Trees', 3, 0], ['DBMS query optimisation assignment', 'assignment', 'DBMS', 4, 0], ['Mini project: deploy', 'project', 'Mini project', 2, 0], ['Revise computer networks', 'study', 'Networks', 5, 0]],
  [['Binary tree practice set', 'dsa', 'Binary Trees', 3, 0], ['Networks lab report', 'assignment', 'Networks', 4, 2], ['Mini project: write README', 'project', 'Mini project', 2, 0], ['Revise graphs basics', 'study', 'Graphs', 5, 0]],
]; // done: 1 = on time, 2 = finished late (half credit), 0 = never

const UPCOMING = [[1, 'Balanced tree check', 'dsa', 'Binary Trees', 4], [3, 'DBMS mini report', 'assignment', 'DBMS', 3], [6, 'Mock test: DSA basics', 'study', 'Graphs', 5]];

// One note for Drift AI to search: a DSA roadmap plus the semester plan, so plans can mention real topics.
export const SAMPLE_NOTE = `Week 1: Arrays and strings. Two pointers, sliding window, prefix sums.

Week 2: Linked lists. Reversal, cycle detection, merging sorted lists.

Week 3: Stacks and queues. Monotonic stack, next greater element.

Week 4: Binary trees. Traversals (inorder, preorder, postorder), height, diameter and level order traversal. Practise at least five tree problems before moving on to graphs.

Week 5: Binary search trees. Insert, delete, validate a BST, lowest common ancestor.

Week 6: Graphs. BFS, DFS, connected components and shortest paths. Graph problems assume you are comfortable with tree traversals.

DBMS: ER diagrams, normalisation, SQL joins, indexing and query optimisation. Assignments are due every second Tuesday.

OS: processes, scheduling, memory management, paging and deadlocks. Lab: scheduler simulation.

Networks: layers, TCP and UDP, routing. The lab report is due before the mid-semester test.

Study tip: finish the high-priority revision topics before starting new project work.`;

// offsetMin is the browser's getTimezoneOffset(), so "today" and every completion fall on the user's own days.
function buildSample(now = new Date(), offsetMin = 0) {
  const base = new Date(dayKey(now, offsetMin) + 'T00:00:00Z'); // the user's local today, as a date-only value
  const due = n => new Date(base.getTime() + n * DAY);
  const doneOn = (n, hour = 12) => new Date(base.getTime() + n * DAY + hour * 3600e3 + offsetMin * 60000);
  const mondayThis = -((base.getUTCDay() + 6) % 7);
  const tasks = [];

  WEEKS.forEach((week, i) => {
    const monday = mondayThis - 7 * (8 - i);
    week.forEach(([title, category, topic, priority, done], k) => {
      const d = monday + k;
      tasks.push({ title, category, topic, priority, dueDate: due(d), ...(done === 1 ? { completedAt: doneOn(d - 1) } : {}) });
    });
  });
  // The recent "late" finishes: one yesterday, one today, so the current streak is 2 and today counts.
  const late = (weekIdx, k, day) => { const t = tasks[weekIdx * 4 + k]; t.completedAt = doneOn(day, 18); };
  late(5, 2, 0); late(7, 1, -1);
  // A daily habit during the good weeks: 24 days in a row, which is what earns the first streak badges.
  for (let n = 0; n < 24; n++) {
    const d = mondayThis - 54 + n;
    tasks.push({ title: 'Daily LeetCode: 1 problem', category: 'dsa', topic: 'Arrays', priority: 1, dueDate: due(d), completedAt: doneOn(d, 20) });
  }
  UPCOMING.forEach(([d, title, category, topic, priority]) => tasks.push({ title, category, topic, priority, dueDate: due(d) }));
  return tasks;
}

// What the sample route inserts. `source: 'sample'` is the tag that makes removal safe; reminded:true keeps it out of emails.
export const sampleTasks = ({ offset = 0, now = new Date() } = {}) => buildSample(now, offset).map(t => ({ ...t, source: 'sample', reminded: true }));
