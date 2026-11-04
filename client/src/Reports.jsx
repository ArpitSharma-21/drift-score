import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from './api.js';
import { ymd, mondayOf, addDays } from './dates.js';

const TONE = { Strong: '#1b6b3f', Okay: '#4f8a62', Slipping: '#b86a1e', Missed: '#c23a1f' };
const wk = s => new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const mn = s => new Date(s + '-15').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const Chip = ({ s }) => <span className="chip" style={{ background: TONE[s] }}>{s}</span>;
const Delta = ({ v }) => v == null ? <span className="mute">first</span>
  : <b style={{ color: v < 0 ? '#c23a1f' : v > 0 ? '#1b6b3f' : '#6a7480' }}>{v > 0 ? '+' : ''}{v} pts</b>;

function Ai({ period, k }) {
  const [txt, setTxt] = useState('');
  const run = async () => { setTxt('Analysing...'); try { setTxt((await api('/ai/coach', 'POST', { period, key: k })).advice); } catch (e) { setTxt(e.message); } };
  return <div className="noprint"><button className="ghostbtn" onClick={run}>AI analysis</button>{txt && <div className="coach">{txt}</div>}</div>;
}

function Week({ w, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'rep' + (selected ? ' sel' : '')}>
      <div className="row">
        <b>Week of {wk(w.week)}</b><span className="pct mono">{w.rate}%</span><Chip s={w.status} />
        <span className="mute">{w.done}/{w.total} done, <Delta v={w.delta} /> vs last week</span>
        <button className="ghostbtn noprint" onClick={() => { setOpen(!open); onSelect(); }}>{open ? 'Hide' : 'Details'}</button>
      </div>
      {open && <div className="more">
        <div>Strongest: <b>{w.best}</b>. Weakest: <b>{w.worst}</b>.</div>
        {w.missed.length > 0 ? <div>Missed tasks<ul>{w.missed.map((m, i) => <li key={i}>{m}</li>)}</ul></div> : <div>Nothing missed this week.</div>}
        <Ai period="week" k={w.week} />
      </div>}
    </div>
  );
}

function Month({ m }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rep">
      <div className="row">
        <b>{mn(m.month)}</b><span className="pct mono">{m.rate}%</span><Chip s={m.status} />
        <span className="mute">{m.done}/{m.total} done, {m.slippedWeeks} slipped {m.slippedWeeks === 1 ? 'week' : 'weeks'}, <Delta v={m.delta} /> vs last month</span>
        <button className="ghostbtn noprint" onClick={() => setOpen(!open)}>{open ? 'Hide weeks' : 'See weeks'}</button>
      </div>
      {open && <div className="more">
        <div>Weakest category this month: <b>{m.worst}</b>.</div>
        {m.weeks.map(w => <div className="wk" key={w.week}><span>Week of {wk(w.week)}</span>
          <div className="bar2"><i style={{ width: w.rate + '%', background: TONE[w.status] }} /></div><b className="mono">{w.rate}%</b><Chip s={w.status} /></div>)}
        <Ai period="month" k={m.month} />
      </div>}
    </div>
  );
}

const WEEKS = 18;
function Heatmap({ tasks, sel, onSelect }) {
  const { cols, months, active } = useMemo(() => {
    const counts = {};
    tasks.forEach(t => { if (t.completedAt) { const k = ymd(t.completedAt); counts[k] = (counts[k] || 0) + 1; } });
    const start = addDays(mondayOf(new Date()), -(WEEKS - 1) * 7), today = ymd(new Date());
    const cols = [], labels = [];
    for (let c = 0; c < WEEKS; c++) {
      const mon = addDays(start, c * 7), label = mon.toLocaleDateString('en-IN', { month: 'short' });
      if (c === 0 || label !== labels[labels.length - 1].label) labels.push({ label, col: c + 1 });
      cols.push({ week: ymd(mon), days: Array.from({ length: 7 }, (_, r) => { const k = ymd(addDays(mon, r)); return { k, n: counts[k] || 0, fut: k > today }; }) });
    }
    const months = labels.filter((m, i) => i === labels.length - 1 || labels[i + 1].col - m.col >= 3);
    return { cols, months, active: cols.reduce((s, c) => s + c.days.filter(d => d.n > 0).length, 0) };
  }, [tasks]);
  const lvl = n => (n >= 4 ? 'l4' : n === 3 ? 'l3' : n === 2 ? 'l2' : n === 1 ? 'l1' : '');
  return (
    <div className="panel">
      <div className="ph"><h3>Active days</h3><span className="sub">{active} in the last {WEEKS} weeks</span></div>
      <div className="hm">
        <div className="days">{['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="scroll">
          <div className="months" style={{ '--cols': WEEKS }}>{months.map(m => <span key={m.col} style={{ gridColumn: m.col }}>{m.label}</span>)}</div>
          <div className="cells">{cols.map(c => (
            <div key={c.week} className={'wcol' + (c.week === sel ? ' sel' : '')}>
              {c.days.map(d => <button key={d.k} className={`cell ${d.fut ? 'fut' : lvl(d.n)}`} title={d.fut ? '' : `${d.k}: ${d.n} done`}
                aria-label={`${d.k}: ${d.n} done`} onClick={() => !d.fut && onSelect(c.week)} />)}
            </div>))}</div>
        </div>
      </div>
      <div className="keyhm">Less{['', 'l1', 'l2', 'l3', 'l4'].map(l => <i key={l} className={'cell ' + l} style={{ width: 11, height: 11 }} />)}More</div>
    </div>
  );
}

function WeekPanel({ tasks, sel, row, current, onReset }) {
  const data = useMemo(() => {
    const mon = new Date(sel + 'T12:00:00');
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
      const k = ymd(addDays(mon, i));
      return { day, Due: tasks.filter(t => ymd(t.dueDate) === k).length, Done: tasks.filter(t => t.completedAt && ymd(t.completedAt) === k).length };
    });
  }, [tasks, sel]);
  const empty = data.every(d => !d.Due && !d.Done);
  return (
    <div className="panel">
      <div className="ph">
        <h3>{sel === current ? 'This week' : `Week of ${wk(sel)}`}</h3>
        {sel !== current ? <button className="ghostbtn noprint" onClick={onReset}>Back to this week</button>
          : row ? <span className="sub mono">{row.rate}%</span> : <span className="sub">in progress</span>}
      </div>
      {row && <div style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center' }}><b className="mono" style={{ fontSize: '1.5rem' }}>{row.rate}%</b><Chip s={row.status} /><span className="sub">{row.done} of {row.total} done</span></div>}
      {empty ? <div className="mute" style={{ padding: '24px 0' }}>No tasks due or finished this week.</div> : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barGap={2} margin={{ left: -18, right: 4, top: 6 }}>
            <CartesianGrid stroke="#e3e6e1" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6a7480' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6a7480' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,.04)' }} />
            <Bar dataKey="Due" fill="#c9ced6" radius={[3, 3, 0, 0]} /><Bar dataKey="Done" fill="#1b6b3f" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>)}
      <div className="legendw"><span><i style={{ background: '#c9ced6' }} />Due</span><span><i style={{ background: '#1b6b3f' }} />Done that day</span></div>
    </div>
  );
}

function Categories({ weeks }) {
  const cats = useMemo(() => {
    const m = {};
    weeks.forEach(w => Object.entries(w.byCategory).forEach(([c, v]) => { const x = (m[c] ||= { total: 0, done: 0 }); x.total += v.total; x.done += v.done; }));
    return Object.entries(m).map(([c, v]) => ({ c, rate: Math.round(100 * v.done / v.total) })).sort((a, b) => a.rate - b.rate);
  }, [weeks]);
  if (!cats.length) return null;
  return (
    <div className="panel"><div className="ph"><h3>Slipping by category</h3><span className="sub">all weeks</span></div>
      {cats.map(x => <div className="cat" key={x.c}><div><span>{x.c}</span><span className="mono">{x.rate}%</span></div>
        <div className="bar2"><i style={{ width: x.rate + '%', background: x.rate < 50 ? '#c23a1f' : x.rate < 75 ? '#b86a1e' : '#1b6b3f' }} /></div></div>)}
    </div>
  );
}

export default function Reports() {
  const current = ymd(mondayOf(new Date()));
  const [mode, setMode] = useState('week');
  const [rep, setRep] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [sel, setSel] = useState(current);
  useEffect(() => { Promise.all([api('/stats/report'), api('/tasks'), api('/stats')]).then(([r, t, s]) => { setRep(r); setTasks(t); setStats(s); }); }, []);

  if (!rep) return <div className="empty">Loading your report...</div>;
  if (!rep.weeks.length) return <div className="empty">No report yet. Reports appear once task deadlines have passed. Add tasks, or load the sample data from the top bar.</div>;
  const best = [...rep.weeks].sort((a, b) => b.rate - a.rate)[0], worst = [...rep.weeks].sort((a, b) => a.rate - b.rate)[0];
  return (
    <div className="cols2">
      <section>
        <div className="rhead">
          <h2>Performance report</h2>
          <div className="noprint" style={{ display: 'flex', gap: 8 }}>
            <div className="seg">{[['week', 'Week by week'], ['month', 'Month by month']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
            <button className="ghostbtn" onClick={() => window.print()}>Print or save PDF</button>
          </div>
        </div>
        <p className="mute" style={{ margin: '4px 0 6px' }}>
          Best week {wk(best.week)} at {best.rate}%. Weakest week {wk(worst.week)} at {worst.rate}%.
          {rep.driftPoint && <> Your drift began the week of <b style={{ color: 'var(--ink)' }}>{wk(rep.driftPoint)}</b>.</>}
        </p>
        {mode === 'week' ? [...rep.weeks].reverse().map(w => <Week key={w.week} w={w} selected={w.week === sel} onSelect={() => setSel(w.week)} />)
          : [...rep.months].reverse().map(m => <Month key={m.month} m={m} />)}
      </section>
      <aside className="side">
        <Heatmap tasks={tasks} sel={sel} onSelect={setSel} />
        <WeekPanel tasks={tasks} sel={sel} row={rep.weeks.find(w => w.week === sel)} current={current} onReset={() => setSel(current)} />
        {stats && <Categories weeks={stats.weeks} />}
      </aside>
    </div>
  );
}
