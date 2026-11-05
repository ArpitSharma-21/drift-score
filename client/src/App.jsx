import { useEffect, useState } from 'react';
import { api } from './api.js';
import Reports from './Reports.jsx';
import Badges from './Badges.jsx';
import Guide from './Guide.jsx';
import { ymd } from './dates.js';

const CATS = ['dsa', 'assignment', 'project', 'study'];
const RISK = { Critical: '#d9482b', 'At Risk': '#e58a3c', Slipping: '#e9c24a', Safe: '#3fa463', 'No data yet': '#6a7480' };
const SEGS = [['Critical', 35], ['At Risk', 20], ['Slipping', 20], ['Safe', 25]];
const NOTE = {
  Safe: 'You are keeping up with the work that matters.',
  Slipping: 'A few tasks are sliding. A small catch-up this week turns it around.',
  'At Risk': 'Deadlines are being missed. Clear the highest priority tasks first.',
  Critical: 'The backlog is heavy. Finish one priority task today, then plan the rest.',
  'No data yet': 'Add tasks with due dates. Your score appears once deadlines pass.',
};

const Logo = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 6l7 2 5-1 8 11" stroke="#d9482b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="2.5" cy="6" r="1.8" fill="#edefea" /></svg>;

function Meter({ score }) {
  return (
    <div className="meter">
      {score != null && <i className="pin" style={{ left: score + '%' }} />}
      <div className="segs">{SEGS.map(([n, w]) => <i key={n} style={{ flex: w, background: RISK[n] }} />)}</div>
      <div className="legend">{SEGS.map(([n, w]) => <span key={n} style={{ flex: w }}>{n}</span>)}</div>
    </div>
  );
}

function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    try { const d = await api('/auth/' + mode, 'POST', f); localStorage.setItem('token', d.token); onDone(); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth">
      <div className="auth-l">
        <div className="brand"><Logo />Drift Score</div>
        <div><h1>See where your studies started to drift.</h1><p style={{ marginTop: 18 }}>Add your work, set priorities, and watch a risk score build from what you actually finish.</p></div>
        <span className="date">Built for students, by a student.</span>
      </div>
      <form className="auth-r" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {mode === 'register' && <><label>Name</label><input onChange={e => setF({ ...f, name: e.target.value })} /></>}
        <label>Email</label><input type="email" onChange={e => setF({ ...f, email: e.target.value })} />
        <label>Password</label><input type="password" placeholder="6 characters or more" onChange={e => setF({ ...f, password: e.target.value })} />
        <button className="add">{mode === 'login' ? 'Log in' : 'Create account'}</button>
        <div className="err">{err}</div>
        <button type="button" className="linkbtn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));
  const [view, setView] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('pending');
  const [err, setErr] = useState('');
  const [t, setT] = useState({ title: '', category: 'dsa', priority: 3, dueDate: ymd(new Date()) });

  const load = async () => {
    const [tk, st, bd] = await Promise.all([api('/tasks'), api('/stats'), api('/badges')]);
    setTasks(tk); setStats(st); setStreak(bd);
    if (bd.fresh?.length) setToast(bd.badges.filter(b => bd.fresh.includes(b.id)).map(b => b.name).join(', '));
  };
  useEffect(() => { if (authed) load().catch(() => { localStorage.clear(); setAuthed(false); }); }, [authed]);

  const now = new Date();
  const overdue = tasks.filter(x => !x.completedAt && new Date(x.dueDate) < now);
  const soon = tasks.filter(x => !x.completedAt && new Date(x.dueDate) >= now && new Date(x.dueDate) - now < 48 * 3600e3);
  const doneCount = tasks.filter(x => x.completedAt).length;

  // Browser reminders: fire while the tab is open.
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    [...overdue, ...soon].slice(0, 3).forEach(x => new Notification('Drift Score', { body: `${x.title} is due ${new Date(x.dueDate).toDateString()}` }));
  }, [tasks.length]);

  if (!authed) return <Auth onDone={() => setAuthed(true)} />;

  const shown = tasks.filter(x => tab === 'done' ? x.completedAt : tab === 'overdue' ? overdue.includes(x) : !x.completedAt)
    .sort((a, b) => tab === 'done' ? new Date(b.completedAt) - new Date(a.completedAt) : b.priority - a.priority || new Date(a.dueDate) - new Date(b.dueDate));
  const add = async e => {
    e.preventDefault();
    if (!t.title.trim()) return setErr('Give the task a name.');
    if (!t.dueDate) return setErr('Pick a due date.');
    setErr(''); await api('/tasks', 'POST', t); setT({ ...t, title: '' }); load();
  };
  const due = x => new Date(x.dueDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const late = x => Math.max(1, Math.floor((now - new Date(x.dueDate)) / 864e5));
  const risk = stats?.risk || 'No data yet';

  return (<>
    <header className="hd">
      <div className="bar">
        <div className="brand"><Logo />Drift Score</div>
        <nav className="links">
          <button className={view === 'tasks' ? 'on' : ''} onClick={() => setView('tasks')}>Tasks</button>
          <button className={view === 'reports' ? 'on' : ''} onClick={() => setView('reports')}>Reports</button>
          <button className={view === 'badges' ? 'on' : ''} onClick={() => setView('badges')}>Badges</button>
          <button className={view === 'guide' ? 'on' : ''} onClick={() => setView('guide')}>How it works</button>
        </nav>
        <div className="tools">
          {'Notification' in window && Notification.permission === 'default' && <button onClick={() => Notification.requestPermission().then(load)}>Turn on reminders</button>}
          <button onClick={() => { localStorage.clear(); setAuthed(false); }}>Log out</button>
        </div>
      </div>
      {view === 'tasks' && stats && (
        <div className="hero">
          <div>
            <div className="date">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div className="score"><span className="n">{stats.score ?? '--'}</span><span className="of">/ 100</span></div>
            <div className="say"><b style={{ color: RISK[risk] }}>{risk}</b><span>{NOTE[risk]}</span></div>
            <Meter score={stats.score} />
            <button className="lnk" onClick={() => setView('guide')}>How is this calculated?</button>
            {stats.driftPoint && <div className="driftnote">Your drift began the week of {new Date(stats.driftPoint + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.
              <button onClick={() => setView('reports')}>See the reports</button></div>}
          </div>
          <div className="figs">
            <div className="fig"><b style={{ color: streak?.activeToday ? '#8fd6a4' : 'inherit' }}>{streak?.current ?? 0}</b><span>day streak</span></div>
            <div className="fig"><b>{doneCount}<small style={{ fontSize: '1rem', color: '#8f99a5' }}>/{tasks.length}</small></b><span>tasks done</span></div>
            <div className="fig"><b style={{ color: overdue.length ? '#f08a73' : 'inherit' }}>{overdue.length}</b><span>overdue</span></div>
            <div className="fig"><b>{soon.length}</b><span>due in 48 hours</span></div>
          </div>
        </div>)}
    </header>

    <main className="main">
      {toast && <div className="toast"><span>New badge unlocked: <b>{toast}</b>.</span><span><button onClick={() => { setView('badges'); setToast(''); }}>See it</button><button onClick={() => setToast('')}>Close</button></span></div>}
      {view === 'reports' ? <Reports /> : view === 'badges' ? <Badges data={streak} tasks={tasks} /> : view === 'guide' ? <Guide /> : (
        <div className="cols">
          <form className="form" onSubmit={add}>
            <h2>New task</h2>
            <label>What needs doing</label>
            <input placeholder="e.g. Solve 3 LeetCode mediums" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} />
            <label>Category</label>
            <div className="chips">{CATS.map(c => <button type="button" key={c} className={t.category === c ? 'on' : ''} onClick={() => setT({ ...t, category: c })}>{c}</button>)}</div>
            <label>Priority</label>
            <div className="prio">{[1, 2, 3, 4, 5].map(p => <button type="button" key={p} className={t.priority === p ? 'on' : ''} onClick={() => setT({ ...t, priority: p })}>{p}</button>)}</div>
            <div className="hint">5 is critical. Missing a 5 hurts your score five times more than missing a 1.</div>
            <label>Due date</label>
            <input type="date" value={t.dueDate} onChange={e => setT({ ...t, dueDate: e.target.value })} />
            <button className="add">Add task</button>
            <div className="err">{err}</div>
          </form>

          <section>
            <div className="listhead"><h2>Your tasks</h2></div>
            <div className="tabs">{[['pending', 'Pending', tasks.length - doneCount], ['overdue', 'Overdue', overdue.length], ['done', 'Done', doneCount]]
              .map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<span className="c">{n}</span></button>)}</div>
            {shown.length === 0 && <div className="empty">{tasks.length === 0 ? 'Nothing here yet. Add your first task on the left.' : tab === 'overdue' ? 'Nothing overdue. Nice.' : 'Nothing in this list.'}</div>}
            <ul className="list">
              {shown.map(x => (
                <li key={x._id} className={`task p${x.priority}${x.completedAt ? ' done' : ''}`}>
                  <button className={'chk' + (x.completedAt ? ' on' : '')} aria-label="Mark done" disabled={!!x.completedAt}
                    onClick={async () => { await api(`/tasks/${x._id}/complete`, 'PATCH'); load(); }}>{x.completedAt ? '✓' : ''}</button>
                  <div className="grow">
                    <div className="tt">{x.title}</div>
                    <div className="meta"><span>{x.category}</span><span>due {due(x)}</span>{!x.completedAt && new Date(x.dueDate) < now && <span className="late">{late(x)} {late(x) === 1 ? 'day' : 'days'} overdue</span>}</div>
                  </div>
                  <span className="tag">P{x.priority}</span>
                  <button className="del" onClick={async () => { await api('/tasks/' + x._id, 'DELETE'); load(); }}>Delete</button>
                </li>))}
            </ul>
            {tasks.length > 0 && <button className="del clear" onClick={async () => { if (window.confirm('Delete all your tasks? Your badges stay.')) { await api('/tasks', 'DELETE'); load(); } }}>Clear all my tasks</button>}
          </section>
        </div>)}
    </main>
  </>);
}
