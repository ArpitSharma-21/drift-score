import { useState } from 'react';

// Keep these numbers in sync with server/src/services/scoring.js
const LATE = 0.5;
const TONE = { Strong: '#1b6b3f', Okay: '#4f8a62', Slipping: '#b86a1e', Missed: '#c23a1f' };
const status = r => (r >= 80 ? 'Strong' : r >= 60 ? 'Okay' : r >= 35 ? 'Slipping' : 'Missed');
const RISK = [
  ['Safe', '75 to 100', '#3fa463', 'You are keeping up with the work that matters.'],
  ['Slipping', '55 to 74', '#e9c24a', 'Some tasks are sliding. A small catch-up fixes it.'],
  ['At Risk', '35 to 54', '#e58a3c', 'Deadlines are being missed regularly. Clear the highest priority tasks first.'],
  ['Critical', '0 to 34', '#d9482b', 'The backlog is heavy. Finish one priority task today, then plan the rest.'],
];
const SECTIONS = [['loop', 'The basic loop'], ['credit', 'Priority and credit'], ['score', 'From weeks to your score'], ['risk', 'Risk levels'],
  ['drift', 'Finding where you drifted'], ['streak', 'Streaks and badges'], ['extras', 'Reminders and AI'], ['ai', 'Drift AI plans'], ['data', 'Your data'], ['faq', 'Common questions']];
const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const pts = n => (Number.isInteger(n) ? n : n.toFixed(1));

function Try() {
  const [rows, setRows] = useState([{ p: 5, o: 'on' }, { p: 3, o: 'late' }, { p: 2, o: 'miss' }]);
  const credit = o => (o === 'on' ? 1 : o === 'late' ? LATE : 0);
  const total = rows.reduce((s, r) => s + r.p, 0);
  const earned = rows.reduce((s, r) => s + r.p * credit(r.o), 0);
  const rate = Math.round((100 * earned) / total);
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === 'p' ? +v : v } : r)));
  return (
    <div className="panel try">
      <h3>Try it: one week, three tasks</h3>
      <p className="mute" style={{ margin: '4px 0 14px' }}>Change the priority or what happened, and watch the week's percentage move.</p>
      {rows.map((r, i) => (
        <div className="trow" key={i}>
          <span className="mono mute">Task {i + 1}</span>
          <select value={r.p} onChange={e => set(i, 'p', e.target.value)} aria-label={`Task ${i + 1} priority`}>{[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Priority {p}</option>)}</select>
          <select value={r.o} onChange={e => set(i, 'o', e.target.value)} aria-label={`Task ${i + 1} outcome`}>
            <option value="on">Finished on time</option><option value="late">Finished late</option><option value="miss">Not finished</option>
          </select>
          <span className="mono">{pts(r.p * credit(r.o))} of {r.p}</span>
        </div>
      ))}
      <div className="tres">
        <span className="mono mute">{pts(earned)} of {total} points</span>
        <b className="mono" style={{ fontSize: '1.6rem' }}>{rate}%</b>
        <span className="chip" style={{ background: TONE[status(rate)] }}>{status(rate)}</span>
      </div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="guide">
      <nav className="toc" aria-label="On this page">
        {SECTIONS.map(([id, t]) => <button key={id} onClick={() => go(id)}>{t}</button>)}
      </nav>
      <div>
        <h1 className="gh">How Drift Score works</h1>
        <p className="lead">Drift Score compares what you planned with what you actually finished, week after week. It does not judge how hard you work. It shows you early whether you are slipping, so you can fix it before it becomes a bad semester.</p>

        <section id="loop" className="gsec">
          <h2>The basic loop</h2>
          <div className="loop">
            {[['1', 'Add a task', 'Give it a name, a category, a due date and a priority from 1 to 5.'],
              ['2', 'Finish it', 'Tick it when it is done. Whether you tick it on time or late matters.'],
              ['3', 'The week gets a percentage', 'Once a week\'s deadlines pass, the tasks due that week become a completion percentage.'],
              ['4', 'Your score updates', 'Recent weeks count the most. Your score and risk level change as soon as you tick something.']]
              .map(([n, t, d]) => <div key={n}><span className="gn mono">{n}</span><b>{t}</b><p>{d}</p></div>)}
          </div>
        </section>

        <section id="credit" className="gsec">
          <h2>Priority and credit</h2>
          <p>Every task is worth as many points as its priority. A priority 5 task is worth 5 points and a priority 1 task is worth 1, so missing one priority 5 hurts as much as missing five priority 1 tasks.</p>
          <table className="gt">
            <thead><tr><th>When you finish the task</th><th>Credit</th></tr></thead>
            <tbody>
              <tr><td>On or before its due date (finishing early counts too)</td><td className="mono">100% of its points</td></tr>
              <tr><td>After its due date</td><td className="mono">50% of its points</td></tr>
              <tr><td>Never</td><td className="mono">0</td></tr>
            </tbody>
          </table>
          <p>A week's percentage is the points you earned divided by the points that were available, times 100. Only tasks due in that week (Monday to Sunday) are part of it.</p>
          <Try />
        </section>

        <section id="score" className="gsec">
          <h2>From weeks to your score</h2>
          <ul className="gl">
            <li><b>Only deadlines that have passed count.</b> A task that is still in the future does not hurt you. If you finish it early, it counts as full credit for the week it was due.</li>
            <li><b>Empty weeks are skipped.</b> A week with no tasks neither raises nor lowers your score.</li>
            <li><b>Recent weeks matter more.</b> Each new week carries 40% of the weight and everything before it carries 60%. A bad month slowly fades if you recover.</li>
            <li><b>Overdue tasks cost extra.</b> Every priority point of an unfinished, overdue task takes off half a point, up to 15 points in total. Finishing the task removes that penalty.</li>
            <li>The result is rounded and never goes below 0 or above 100.</li>
          </ul>
        </section>

        <section id="risk" className="gsec">
          <h2>Risk levels</h2>
          <p>Your score maps to one of four levels. The pin on the strip at the top of the Tasks page shows where you are.</p>
          <div className="rks">
            {RISK.map(([n, r, c, d]) => <div className="rk" key={n}><i style={{ background: c }} /><b>{n}</b><span className="mono mute">{r}</span><span>{d}</span></div>)}
          </div>
          <p className="mute" style={{ marginTop: 14 }}>On the Reports page, each single week gets its own label: Strong (80% or more), Okay (60 to 79), Slipping (35 to 59) or Missed (under 35).</p>
        </section>

        <section id="drift" className="gsec">
          <h2>Finding where you drifted</h2>
          <p>The drift point is the first week where your results fell well below your own normal. In numbers: the next two weeks average at least 20 points under the three weeks before, and that week itself is at least 15 points under. It needs at least five weeks of history before it can show up.</p>
          <p>The Reports page then lets you look at each week: its percentage, the change from the week before, the tasks you missed, and your strongest and weakest category. Press Details on a week to see them.</p>
        </section>

        <section id="streak" className="gsec">
          <h2>Streaks and badges</h2>
          <p>A day counts when you finish at least one task, using your own timezone. Miss a whole day and your current streak goes back to zero. Today is not counted as missed until it ends.</p>
          <p>Reaching 7, 14, 21, 30, 45, 60, 90, 120, 180 and 365 days in a row earns the 10 badges. Badges you have earned stay for good, even if the streak breaks later. The activity graph on the Badges page shows how many tasks you finished each day, and darker green means more tasks that day.</p>
        </section>

        <section id="extras" className="gsec">
          <h2>Reminders and AI</h2>
          <ul className="gl">
            <li><b>Reminders.</b> Press Turn on reminders in the top bar to get browser notifications for tasks that are due soon or overdue. They only appear while this site is open in a tab.</li>
            <li><b>AI analysis.</b> On the Reports page, press AI analysis on a week or a month. The AI gets your score, your weekly percentages, your strongest and weakest category and, for the week you pick, the titles of the tasks you missed. It then writes a short explanation and a plan. It never changes your tasks.</li>
            <li>Because those task titles are sent to an outside AI service, keep private details out of your task names.</li>
          </ul>
        </section>

                <section id="ai" className="gsec">
          <h2>Drift AI plans</h2>
          <p>When your score trend falls, or whenever you ask, Drift AI builds a 7-day recovery plan. It works in four steps. The app first works out the facts from your own tasks: weekly percentages, your weakest topics, recently missed tasks and how many tasks you usually finish in a day. It then searches the study material you saved for the most relevant excerpts. The AI then explains the likely causes, quoting the evidence, and proposes small tasks. Finally the app checks the plan (a daily limit, no duplicates, valid priorities) before showing it to you.</p>
          <p>Nothing is added to your list until you approve it, and you can untick tasks you do not want. Tasks it creates are marked "Drift AI". Progress is measured from the tasks you really complete, never from what the AI says.</p>
          <p>When you ask for a plan, your score data, topic and task titles and the matching note excerpts are sent to an outside AI service. Keep private details out of your notes, and delete a note whenever you like.</p>
        </section>

        <section id="data" className="gsec">
          <h2>Your data</h2>
          <p>Your account and tasks are stored in a database. Passwords are stored hashed, never as plain text. On the Tasks page, Clear all my tasks deletes your tasks, and your badges stay. This is a student project, so please do not store anything sensitive in it.</p>
        </section>

        <section id="faq" className="gsec">
          <h2>Common questions</h2>
          {[['Why does my score show two dashes?', 'No deadline has passed yet. The score appears after at least one task\'s due date has gone by.'],
            ['I finished tasks late and my score still dropped. Why?', 'Late tasks earn half credit, and tasks that are still overdue keep adding to the backlog penalty until you finish them.'],
            ['Does finishing an old overdue task help?', 'Yes. It stops counting toward the backlog penalty and it earns half credit for the week it was originally due.'],
            ['Why did my streak reset?', 'A day with no finished task ends it. Finishing even one small task a day keeps it going.']]
            .map(([q, a]) => <div className="qa" key={q}><b>{q}</b><p>{a}</p></div>)}
        </section>
      </div>
    </div>
  );
}
