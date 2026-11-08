import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function Recovery({ onChanged }) {
  const [st, setSt] = useState(null);
  const [docs, setDocs] = useState([]);
  const [focus, setFocus] = useState('');
  const [plan, setPlan] = useState(null);
  const [picks, setPicks] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', text: '' });
  const [docErr, setDocErr] = useState('');

  const load = async () => {
    const [s, d] = await Promise.all([api('/recovery/status'), api('/recovery/docs')]);
    setSt(s); setDocs(d);
    if (s.plan?.status === 'proposed') { setPlan(s.plan); setPicks(s.plan.items.map((_, i) => i)); } else setPlan(null);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const investigate = async () => {
    setBusy('plan'); setErr('');
    try { const p = await api('/recovery/plan', 'POST', { focus }); setPlan(p); setPicks(p.items.map((_, i) => i)); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  const approve = async () => {
    setBusy('approve'); setErr('');
    try { await api(`/recovery/plan/${plan.id}/approve`, 'POST', { items: picks }); setPlan(null); await load(); onChanged?.(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  const dismiss = async () => { await api(`/recovery/plan/${plan.id}/dismiss`, 'POST'); setPlan(null); load(); };
  const addDoc = async e => {
    e.preventDefault(); setBusy('doc'); setDocErr('');
    try { await api('/recovery/docs', 'POST', form); setForm({ title: '', text: '' }); await load(); }
    catch (x) { setDocErr(x.message); }
    setBusy('');
  };
  const delDoc = async id => { await api('/recovery/docs/' + id, 'DELETE'); load(); };
  const toggle = i => setPicks(picks.includes(i) ? picks.filter(x => x !== i) : [...picks, i]);

  if (!st) return <div className="empty">Loading Drift AI...</div>;
  const active = st.plan?.status === 'active' ? st : null;
  const days = plan ? [...new Set(plan.items.map(i => i.day))].sort((a, b) => a - b) : [];

  return (
    <div className="ai-wrap">
      <div>
        <h1 className="gh">Drift AI</h1>
        <p className="lead">Finds why your score slipped, then builds a small 7-day recovery plan from your own tasks and notes. Nothing is added to your list until you approve it.</p>
        <p className="mute" style={{ margin: '0 0 22px' }}>
          {st.trend.now == null ? 'Add some tasks and let a few deadlines pass, and Drift AI will have something to work with.'
            : st.trend.detected ? <>Your score trend fell from <b>{st.trend.peak}</b> to <b>{st.trend.now}</b> over the last few weeks.</>
              : <>Your score trend is steady at <b>{st.trend.now}</b>. You can still ask for a plan.</>}
        </p>

        {active && (
          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="ph"><h3>Your plan is in progress</h3><span className="sub mono">{active.progress.done} of {active.progress.total} done</span></div>
            <div className="bar2 big2"><i style={{ width: (active.progress.total ? (100 * active.progress.done) / active.progress.total : 0) + '%', background: 'var(--green)' }} /></div>
            <p className="mute" style={{ margin: '12px 0 0' }}>{active.plan.summary}</p>
            {active.progress.overdue > 0 && <p style={{ margin: '8px 0 0', color: 'var(--flame)' }}>{active.progress.overdue} of its tasks are overdue. Finish them from the Tasks page. Progress only counts tasks you actually complete.</p>}
          </section>)}

        {!active && !plan && (
          <section className="panel">
            <h3>What do you want to fix?</h3>
            <p className="mute" style={{ margin: '4px 0 12px', fontSize: '.88rem' }}>Optional. For example: "Why am I weak in DSA?" or "I keep missing assignments".</p>
            <textarea rows="2" value={focus} maxLength={300} onChange={e => setFocus(e.target.value)} placeholder="Leave empty and Drift AI will look at your whole picture" />
            <button className="add" disabled={busy === 'plan'} onClick={investigate}>{busy === 'plan' ? 'Investigating...' : 'Investigate and build a plan'}</button>
            {err && <div className="err">{err}</div>}
          </section>)}

        {plan && (
          <section className="panel plan">
            <h3>What I found</h3>
            <p style={{ margin: '6px 0 12px' }}>{plan.summary}</p>
            <ul className="causes">{plan.causes.map((c, i) => <li key={i}><b>{c.text}</b><span className="mute">Evidence: {c.evidence}</span></li>)}</ul>

            <h3 style={{ marginTop: 22 }}>Your 7-day plan</h3>
            <p className="mute" style={{ margin: '2px 0 10px', fontSize: '.86rem' }}>Untick anything you do not want. Only ticked tasks are added.</p>
            {days.map(d => (
              <div className="day" key={d}><b className="mono">Day {d}</b>
                <div>{plan.items.map((it, i) => it.day !== d ? null : (
                  <label className="pick" key={i}>
                    <input type="checkbox" checked={picks.includes(i)} onChange={() => toggle(i)} />
                    <span>{it.title}<small>{it.category}{it.topic ? `, ${it.topic}` : ''}, priority {it.priority}</small></span>
                  </label>))}</div>
              </div>))}

            <details className="src"><summary>{plan.sources.length ? `Notes I used (searched by ${plan.mode === 'meaning' ? 'meaning' : 'keywords'})` : 'No notes were used'}</summary>
              {plan.sources.length ? plan.sources.map((s, i) => <p key={i}><b>{s.title}:</b> {s.snippet}...</p>) : <p>Add study material on the right so plans can use your own syllabus or roadmap.</p>}
            </details>
            {plan.trace?.length > 0 && <p className="mono mute" style={{ fontSize: '.74rem', margin: '10px 0 0' }}>{plan.trace.map(t => `${t.step} (${t.ms} ms)`).join('  >  ')}</p>}

            <div className="pbar">
              <button className="add" disabled={!picks.length || busy === 'approve'} onClick={approve}>{busy === 'approve' ? 'Adding...' : `Add ${picks.length} ${picks.length === 1 ? 'task' : 'tasks'} to my list`}</button>
              <button className="ghostbtn" onClick={dismiss}>Not now</button>
            </div>
            {err && <div className="err">{err}</div>}
          </section>)}
      </div>

      <aside className="side2">
        <section className="panel">
          <div className="ph"><h3>Your study material</h3><span className="sub">{docs.length} of 10</span></div>
          <p className="mute" style={{ margin: '0 0 12px', fontSize: '.86rem' }}>Paste a syllabus, roadmap, topic list or your own notes. Drift AI searches them when it builds a plan.</p>
          {docs.map(d => (
            <div className="doc" key={d._id}><div><b>{d.title}</b><small className="mute">{d.chunkCount} parts, search by {d.mode === 'meaning' ? 'meaning' : 'keywords'}</small></div>
              <button className="del" onClick={() => delDoc(d._id)}>Delete</button></div>))}
          <form onSubmit={addDoc} style={{ marginTop: 12 }}>
            <input placeholder="Title, e.g. DSA roadmap" value={form.title} maxLength={80} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea rows="6" style={{ marginTop: 8 }} placeholder="Paste text here (up to 20,000 characters)" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
            <button className="ghostbtn" style={{ marginTop: 8 }} disabled={busy === 'doc'}>{busy === 'doc' ? 'Saving...' : 'Save note'}</button>
            {docErr && <div className="err">{docErr}</div>}
          </form>
        </section>
        <p className="mute" style={{ fontSize: '.8rem', margin: '14px 2px 0' }}>When you ask for a plan, your score data, task titles and the matching note excerpts are sent to the AI service. Keep private details out of your notes. You can delete a note any time.</p>
      </aside>
    </div>
  );
}
