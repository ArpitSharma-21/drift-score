import { useEffect, useMemo, useRef } from 'react';
import { ymd, mondayOf, addDays } from './dates.js';

const WEEKS = 52;
// 1 task = lightest green, 5 or more in a day = full green.
const level = n => (n >= 5 ? 'l4' : n >= 3 ? 'l3' : n === 2 ? 'l2' : n === 1 ? 'l1' : '');

export default function Heatmap({ tasks }) {
  const ref = useRef(null);
  const { cols, months, active, total } = useMemo(() => {
    const counts = {};
    tasks.forEach(t => { if (t.completedAt) { const k = ymd(t.completedAt); counts[k] = (counts[k] || 0) + 1; } });
    const start = addDays(mondayOf(new Date()), -(WEEKS - 1) * 7), today = ymd(new Date());
    const cols = [], labels = [];
    let active = 0, total = 0;
    for (let c = 0; c < WEEKS; c++) {
      const mon = addDays(start, c * 7), label = mon.toLocaleDateString('en-IN', { month: 'short' });
      if (c === 0 || label !== labels[labels.length - 1].label) labels.push({ label, col: c + 1 });
      cols.push({ week: ymd(mon), days: Array.from({ length: 7 }, (_, r) => {
        const k = ymd(addDays(mon, r)), n = counts[k] || 0;
        if (n) { active++; total += n; }
        return { k, n, fut: k > today, today: k === today };
      }) });
    }
    return { cols, months: labels.filter((m, i) => i === labels.length - 1 || labels[i + 1].col - m.col >= 3), active, total };
  }, [tasks]);

  useEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [tasks]);

  return (
    <section className="panel activity">
      <div className="ph"><h3>Activity</h3><span className="sub">{active} active {active === 1 ? 'day' : 'days'}, {total} {total === 1 ? 'task' : 'tasks'} finished in the last year</span></div>
      <div className="hm">
        <div className="days" aria-hidden="true">{['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="scroll" ref={ref}>
          <div className="months" style={{ '--cols': WEEKS }} aria-hidden="true">{months.map(m => <span key={m.col} style={{ gridColumn: m.col }}>{m.label}</span>)}</div>
          <div className="cells" role="img" aria-label={`Activity graph: ${active} active days in the last year`}>
            {cols.map(c => (
              <div key={c.week} className="wcol">
                {c.days.map(d => <i key={d.k} className={`cell ${d.fut ? 'fut' : level(d.n)}${d.today ? ' today' : ''}`}
                  title={d.fut ? '' : `${d.n} ${d.n === 1 ? 'task' : 'tasks'} finished on ${d.k}`} />)}
              </div>))}
          </div>
        </div>
      </div>
      <div className="keyhm">
        <span>A day turns green when you finish a task. Darker green means more tasks that day.</span>
        <span className="scale">Less{['', 'l1', 'l2', 'l3', 'l4'].map(l => <i key={l} className={'cell ' + l} />)}More</span>
      </div>
    </section>
  );
}
