import { useEffect, useState } from 'react';
import { api } from './api.js';

const TONE = { Strong: '#15803d', Okay: '#0f766e', Slipping: '#b45309', Missed: '#be123c' };
const wk = s => new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const mn = s => new Date(s + '-15').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const Chip = ({ s }) => <span className="chip" style={{ background: TONE[s] }}>{s}</span>;
const Delta = ({ v }) => v == null ? <span className="mute">first</span>
  : <b style={{ color: v < 0 ? 'var(--crit)' : v > 0 ? 'var(--safe)' : 'var(--mute)' }}>{v > 0 ? '+' : ''}{v} pts</b>;

function Ai({ period, k }) {
  const [txt, setTxt] = useState('');
  const run = async () => { setTxt('Analysing...'); try { setTxt((await api('/ai/coach', 'POST', { period, key: k })).advice); } catch (e) { setTxt(e.message); } };
  return <div><button className="noprint" onClick={run}>AI analysis</button>{txt && <div className="coach">{txt}</div>}</div>;
}

function Week({ w }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rep">
      <div className="row">
        <b>Week of {wk(w.week)}</b><span style={{ fontSize: '1.3rem', fontWeight: 800 }}>{w.rate}%</span><Chip s={w.status} />
        <span className="mute">{w.done}/{w.total} done, <Delta v={w.delta} /> vs last week</span>
        <button className="noprint" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Details'}</button>
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
        <b>{mn(m.month)}</b><span style={{ fontSize: '1.3rem', fontWeight: 800 }}>{m.rate}%</span><Chip s={m.status} />
        <span className="mute">{m.done}/{m.total} done, {m.slippedWeeks} slipped week{m.slippedWeeks === 1 ? '' : 's'}, <Delta v={m.delta} /> vs last month</span>
        <button className="noprint" onClick={() => setOpen(!open)}>{open ? 'Hide weeks' : 'See weeks'}</button>
      </div>
      {open && <div className="more">
        <div>Weakest category this month: <b>{m.worst}</b>.</div>
        {m.weeks.map(w => <div className="wk" key={w.week}><span>Week of {wk(w.week)}</span>
          <div className="bar"><i style={{ width: w.rate + '%', background: TONE[w.status] }} /></div><b>{w.rate}%</b><Chip s={w.status} /></div>)}
        <Ai period="month" k={m.month} />
      </div>}
    </div>
  );
}

export default function Reports() {
  const [mode, setMode] = useState('week');
  const [rep, setRep] = useState(null);
  useEffect(() => { api('/stats/report').then(setRep); }, []);
  if (!rep) return <div className="card empty">Loading report...</div>;
  if (!rep.weeks.length) return <div className="card empty">No report yet. Reports appear once task deadlines have passed. Add tasks, or load sample data from the Dashboard.</div>;
  const best = [...rep.weeks].sort((a, b) => b.rate - a.rate)[0], worst = [...rep.weeks].sort((a, b) => a.rate - b.rate)[0];
  return (
    <section className="card">
      <div className="head">
        <h2>Performance report</h2>
        <div style={{ display: 'flex', gap: 8 }} className="noprint">
          <div className="tabs">{[['week', 'Week by week'], ['month', 'Month by month']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
          <button onClick={() => window.print()}>Print or save as PDF</button>
        </div>
      </div>
      <p className="mute" style={{ marginTop: 0 }}>
        Best week: {wk(best.week)} ({best.rate}%). Weakest week: {wk(worst.week)} ({worst.rate}%).
        {rep.driftPoint && <> Your drift started the week of <b>{wk(rep.driftPoint)}</b>.</>}
      </p>
      {mode === 'week' ? [...rep.weeks].reverse().map(w => <Week key={w.week} w={w} />) : [...rep.months].reverse().map(m => <Month key={m.month} m={m} />)}
    </section>
  );
}
