import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { api } from './api.js';
import Reports from './Reports.jsx';

const COLOR = { Safe: '#15803d', Slipping: '#b45309', 'At Risk': '#c2410c', Critical: '#be123c', 'No data yet': '#5d6b7a' };
const MSG = {
  Safe: 'You are keeping up with the work that matters. Keep the streak going.',
  Slipping: 'Some tasks are starting to slide. A small catch-up this week will turn it around.',
  'At Risk': 'Deadlines are being missed regularly. Pick the highest priority tasks and clear them first.',
  Critical: 'The backlog is heavy. Reset: finish one priority task today and plan the rest.',
  'No data yet': 'Add tasks with due dates. Your score appears once deadlines pass.',
};
const day = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

function Gauge({ score, risk }) {
  const R = 100, C = Math.PI * R, pct = score == null ? 0 : score / 100;
  return (
    <div className="gauge">
      <svg viewBox="0 0 240 140" width="100%">
        <path d="M20 125 A100 100 0 0 1 220 125" fill="none" stroke="#dde4ec" strokeWidth="18" strokeLinecap="round" />
        <path d="M20 125 A100 100 0 0 1 220 125" fill="none" stroke={COLOR[risk]} strokeWidth="18" strokeLinecap="round"
          strokeDasharray={`${C * pct} ${C}`} style={{ transition: 'stroke-dasharray .8s ease' }} />
      </svg>
      <div className="num"><strong>{score ?? '--'}</strong><span style={{ color: COLOR[risk] }}>{risk}</span></div>
    </div>
  );
}

function Heatmap({ tasks }) {
  const cells = useMemo(() => {
    const m = {}; tasks.forEach(t => t.completedAt && (m[day(t.completedAt)] = (m[day(t.completedAt)] || 0) + 1));
    const out = [], today = new Date(); today.setHours(12);
    const start = new Date(today); start.setDate(start.getDate() - 83 - ((start.getDay() + 6) % 7));
    for (let i = 0; i < 84 + ((today.getDay() + 6) % 7) + 1; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (d > today) break;
      const n = m[day(d)] || 0; out.push({ d: day(d), n });
    }
    return out;
  }, [tasks]);
  return <div className="heat">{cells.map(c => <i key={c.d} title={`${c.d}: ${c.n} done`} className={c.n >= 3 ? 'l3' : c.n === 2 ? 'l2' : c.n === 1 ? 'l1' : ''} />)}</div>;
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
    <form className="login card" onSubmit={submit}>
      <h1>Drift Score</h1>
      <p style={{ color: 'var(--mute)', margin: 0 }}>See when your studies start slipping, and where it began.</p>
      {mode === 'register' && <input placeholder="Name" onChange={e => setF({ ...f, name: e.target.value })} />}
      <input placeholder="Email" type="email" onChange={e => setF({ ...f, email: e.target.value })} />
      <input placeholder="Password (6+ characters)" type="password" onChange={e => setF({ ...f, password: e.target.value })} />
      <button className="primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <div className="err">{err}</div>
      <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
      </button>
    </form>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('pending');
  const [view, setView] = useState('dash');
  const [advice, setAdvice] = useState('');
  const [t, setT] = useState({ title: '', category: 'dsa', priority: 3, dueDate: '' });

  const load = async () => { setTasks(await api('/tasks')); setStats(await api('/stats')); };
  useEffect(() => { if (authed) load().catch(() => { localStorage.clear(); setAuthed(false); }); }, [authed]);

  const now = new Date();
  const overdue = tasks.filter(x => !x.completedAt && new Date(x.dueDate) < now);
  const soon = tasks.filter(x => !x.completedAt && new Date(x.dueDate) >= now && new Date(x.dueDate) - now < 48 * 3600e3);

  // Browser reminders: fires while the tab is open (real push comes in the next phase).
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    [...overdue, ...soon].slice(0, 3).forEach(x => new Notification('Drift Score reminder', { body: `${x.title} is due ${new Date(x.dueDate).toDateString()}` }));
  }, [tasks.length]);

  const cats = useMemo(() => {
    const m = {}; (stats?.weeks || []).forEach(w => Object.entries(w.byCategory).forEach(([c, v]) => { m[c] ||= { total: 0, done: 0 }; m[c].total += v.total; m[c].done += v.done; }));
    return Object.entries(m).map(([c, v]) => ({ c, rate: Math.round(100 * v.done / v.total) })).sort((a, b) => a.rate - b.rate);
  }, [stats]);

  if (!authed) return <Auth onDone={() => setAuthed(true)} />;

  const shown = tasks.filter(x => tab === 'done' ? x.completedAt : tab === 'overdue' ? overdue.includes(x) : !x.completedAt)
    .sort((a, b) => tab === 'done' ? new Date(b.completedAt) - new Date(a.completedAt) : b.priority - a.priority || new Date(a.dueDate) - new Date(b.dueDate));
  const add = async e => { e.preventDefault(); if (!t.title || !t.dueDate) return; await api('/tasks', 'POST', t); setT({ ...t, title: '' }); load(); };
  const coach = async () => { setAdvice('Reading your last 8 weeks...'); try { setAdvice((await api('/ai/coach', 'POST')).advice); } catch (e) { setAdvice(e.message); } };
  const doneCount = tasks.filter(x => x.completedAt).length;

  return (<>
    <div className="top">
      <div className="nav"><b>Drift Score</b>
        <button className={view === 'dash' ? 'on' : ''} onClick={() => setView('dash')}>Dashboard</button>
        <button className={view === 'reports' ? 'on' : ''} onClick={() => setView('reports')}>Reports</button></div>
      <div className="actions">
        {'Notification' in window && Notification.permission === 'default' && <button onClick={() => Notification.requestPermission().then(() => load())}>Turn on reminders</button>}
        {tasks.length === 0 && <button onClick={async () => { await api('/tasks/seed', 'POST'); load(); }}>Load sample data</button>}
        <button onClick={() => { localStorage.clear(); setAuthed(false); }}>Log out</button>
      </div>
    </div>
    <div className="wrap">
      {view === 'reports' ? <Reports /> : <>
      {stats && (
        <section className="card hero">
          <Gauge score={stats.score} risk={stats.risk} />
          <div>
            <h2>{stats.risk === 'No data yet' ? 'Welcome' : `Your risk level is ${stats.risk}`}</h2>
            <p>{MSG[stats.risk]}</p>
            {stats.driftPoint && <div className="drift">Your drift started the week of {stats.driftPoint}. Look at what changed around then.</div>}
            <div className="stats">
              <div className="stat"><small>Tasks completed</small><strong>{doneCount}/{tasks.length}</strong></div>
              <div className="stat"><small>Overdue</small><strong style={{ color: overdue.length ? 'var(--crit)' : 'inherit' }}>{overdue.length}</strong></div>
              <div className="stat"><small>Due in 48 hours</small><strong>{soon.length}</strong></div>
              <div className="stat"><small>Backlog weight</small><strong>{stats.backlog}</strong></div>
            </div>
          </div>
        </section>
      )}

      {(overdue.length > 0 || soon.length > 0) && (
        <section className="card"><h3 style={{ marginBottom: 10 }}>Needs your attention</h3>
          {overdue.slice(0, 3).map(x => <div className="alert" key={x._id}><b>{x.title}</b> was due {new Date(x.dueDate).toDateString()}</div>)}
          {soon.slice(0, 3).map(x => <div className="alert soon" key={x._id}><b>{x.title}</b> is due {new Date(x.dueDate).toDateString()}</div>)}
        </section>)}

      <section className="card"><h3 style={{ marginBottom: 12 }}>Add a task</h3>
        <form className="add" onSubmit={add}>
          <input placeholder="e.g. Solve 3 LeetCode mediums" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} />
          <select value={t.category} onChange={e => setT({ ...t, category: e.target.value })}>{['dsa', 'assignment', 'project', 'study'].map(c => <option key={c}>{c}</option>)}</select>
          <select value={t.priority} onChange={e => setT({ ...t, priority: +e.target.value })}>{[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Priority {p}</option>)}</select>
          <input type="date" value={t.dueDate} onChange={e => setT({ ...t, dueDate: e.target.value })} />
          <button className="primary">Add task</button>
        </form>
      </section>

      <div className="grid2">
        <section className="card">
          <div className="head"><h3>Tasks</h3>
            <div className="tabs">{[['pending', 'Pending'], ['overdue', 'Overdue'], ['done', 'Done']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          </div>
          {shown.length === 0 && <div className="empty">Nothing here. {tasks.length === 0 ? 'Add your first task above, or load sample data from the top bar.' : ''}</div>}
          {shown.map(x => (
            <div key={x._id} className={'task' + (x.completedAt ? ' done' : '')}>
              <button className={'chk' + (x.completedAt ? ' on' : '')} aria-label="Mark done" disabled={!!x.completedAt}
                onClick={async () => { await api(`/tasks/${x._id}/complete`, 'PATCH'); load(); }}>{x.completedAt ? '✓' : ''}</button>
              <div className="t">{x.title}<small>{x.category}, due {new Date(x.dueDate).toLocaleDateString()}</small></div>
              <span className={'pill p' + x.priority}>P{x.priority}</span>
              <button className="ghost" aria-label="Delete" onClick={async () => { await api('/tasks/' + x._id, 'DELETE'); load(); }}>Delete</button>
            </div>))}
        </section>
        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <section className="card"><h3 style={{ marginBottom: 12 }}>Where you are slipping</h3>
            {cats.length === 0 ? <div className="empty">Appears after your first deadlines pass.</div> :
              cats.map(x => <div className="cat" key={x.c}><div><span>{x.c}</span><span>{x.rate}%</span></div><div className="bar"><i style={{ width: x.rate + '%', background: x.rate < 50 ? 'var(--crit)' : x.rate < 75 ? 'var(--slip)' : 'var(--safe)' }} /></div></div>)}
          </section>
          <section className="card"><h3 style={{ marginBottom: 12 }}>Last 12 weeks of completions</h3><Heatmap tasks={tasks} /></section>
        </div>
      </div>

      {stats?.weeks.length > 0 && (
        <div className="grid2">
          <section className="card"><h3 style={{ marginBottom: 12 }}>Weekly completion</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.weeks}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity=".35" /><stop offset="100%" stopColor="#0f766e" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid stroke="#e6ecf2" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} /><Tooltip />
                {stats.driftPoint && <ReferenceLine x={stats.driftPoint} stroke="#be123c" strokeDasharray="4 4" label={{ value: 'Drift starts', fill: '#be123c', fontSize: 12, position: 'insideTopRight' }} />}
                <Area dataKey="rate" name="Completion" stroke="#0f766e" strokeWidth={2.5} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer></section>
          <section className="card"><h3 style={{ marginBottom: 12 }}>Month by month</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.months}><CartesianGrid stroke="#e6ecf2" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="rate" name="Average" fill="#14202b" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer></section>
        </div>)}

      <section className="card"><div className="head"><h3>AI coach</h3><button className="primary" onClick={coach}>Analyse my last 8 weeks</button></div>
        <div style={{ color: 'var(--mute)' }}>Reads your own completion data, finds where the drift began, and gives you a plan for next week.</div>
        {advice && <div className="coach">{advice}</div>}
      </section>
      </>}
    </div>
  </>);
}
