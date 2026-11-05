import Heatmap from './Heatmap.jsx';
const FILL = ['#4faa6c', '#3f9a5f', '#2f8a52', '#26784a', '#1b6b3f', '#c27a1f', '#b8661a', '#d9482b', '#a8321a', '#12161c'];
const GOLD = '#e9c24a';

function Medal({ days, i, earned }) {
  const last = i === FILL.length - 1;
  return (
    <svg viewBox="0 0 100 100" width="92" height="92" role="img" aria-label={`${days} day badge, ${earned ? 'earned' : 'locked'}`}>
      <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill={earned ? FILL[i] : 'none'}
        stroke={earned ? 'none' : '#b4bbc4'} strokeWidth="2" strokeDasharray={earned ? undefined : '5 5'} />
      {earned && <polygon points="50,12 83,31 83,69 50,88 17,69 17,31" fill="none" stroke={last ? GOLD : 'rgba(255,255,255,.45)'} strokeWidth="1.5" />}
      <text x="50" y="56" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontWeight="500" fontSize="28" fill={earned ? '#fff' : '#a3abb5'}>{days}</text>
      <text x="50" y="71" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={earned ? 'rgba(255,255,255,.8)' : '#a3abb5'}>DAYS</text>
    </svg>
  );
}

export default function Badges({ data, tasks = [] }) {
  if (!data) return <div className="empty">Loading your streak...</div>;
  const earned = data.badges.filter(b => b.earned).length;
  const next = data.next && data.badges.find(b => b.id === data.next.id);
  const pct = data.next ? Math.min(100, Math.round((100 * data.current) / data.next.days)) : 100;
  const date = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div>
      <section className="streakbox">
        <div><div className="sn">{data.current}</div><div className="sl">day streak</div></div>
        <div className="grow">
          <div className="srow">
            <b>{next ? `${data.next.left} more ${data.next.left === 1 ? 'day' : 'days'} to ${next.name}` : 'Every badge unlocked'}</b>
            <span className="mute">Best streak: {data.best} {data.best === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="bar2 big"><i style={{ width: pct + '%', background: 'var(--green)' }} /></div>
          <p className="mute" style={{ margin: '10px 0 0' }}>
            {data.activeToday ? 'You finished a task today. Your streak is safe until tomorrow.'
              : data.current > 0 ? 'Finish one task today to keep your streak alive.' : 'Finish a task today to start a streak.'}
          </p>
        </div>
      </section>

      <Heatmap tasks={tasks} />

      <div className="bh"><h2>Badges</h2><span className="mute mono">{earned} of {data.badges.length} earned</span></div>
      <div className="badges">
        {data.badges.map((b, i) => (
          <div key={b.id} className={'bcard' + (b.earned ? ' on' : '')}>
            <Medal days={b.days} i={i} earned={b.earned} />
            <b>{b.name}</b>
            <span className="mute">{b.line}</span>
            <span className="bstat mono">{b.earned ? `Earned ${date(b.earnedAt)}` : `${Math.max(0, b.days - data.current)} days to go`}</span>
          </div>
        ))}
      </div>
      <p className="mute fine">A day counts when you finish at least one task. Missing a day resets your current streak, but the badges you have earned stay.</p>
    </div>
  );
}
