import { useEffect, useState } from 'react';
import { api } from './api.js';

const LABEL = { 8: '8 AM', 13: '1 PM', 19: '7 PM', 21: '9 PM' };
const keyBytes = s => { const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export default function NotifySettings() {
  const [cfg, setCfg] = useState(null);
  const [here, setHere] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setCfg(await api('/nudges/settings'));
    if (supported()) { const reg = await navigator.serviceWorker.ready; setHere(!!(await reg.pushManager.getSubscription())); }
  };
  useEffect(() => { load().catch(() => {}); }, []);
  if (!cfg) return null;

  const run = async fn => { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg(e.message || 'Something went wrong.'); } setBusy(false); };
  const save = patch => run(async () => setCfg(await api('/nudges/settings', 'PUT', patch)));

  const turnOn = () => run(async () => {
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings and try again.');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.vapidKey) });
    await api('/nudges/subscribe', 'POST', { subscription: sub.toJSON() });
    await load();
  });
  const turnOff = () => run(async () => {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) { await api('/nudges/subscribe', 'DELETE', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
    await load();
  });
  const test = () => run(async () => {
    const r = await api('/nudges/test', 'POST');
    setMsg(r.push || r.email ? `Sent${r.push ? ` to ${r.push} ${r.push === 1 ? 'device' : 'devices'}` : ''}${r.email ? `${r.push ? ' and' : ' to'} your email` : ''}. Check it now.` : 'Nothing was sent. Turn on a notification option above first.');
  });
  const ios = /iPhone|iPad/.test(navigator.userAgent);

  return (
    <section className="notify">
      <h3>When you are away</h3>
      <p className="mute" style={{ margin: '4px 0 12px', fontSize: '.86rem' }}>Get one nudge a day, only on days you have not finished a task yet.</p>

      <div className="nrow">
        <div><b>Notifications on this device</b>
          {!cfg.pushReady ? <div className="hint">Not set up on the server yet.</div>
            : !supported() ? <div className="hint">{ios ? 'On iPhone, open this site in Safari, tap Share, then Add to Home Screen. Open it from the home screen and come back here.' : 'This browser does not support them.'}</div>
            : null}</div>
        {cfg.pushReady && supported() && (here
          ? <button className="ghostbtn" disabled={busy} onClick={turnOff}>Turn off</button>
          : <button className="ghostbtn" disabled={busy} onClick={turnOn}>Turn on</button>)}
      </div>

      <div className="nrow">
        <div><b>Email me too</b>{!cfg.emailReady && <div className="hint">Email is not set up on the server yet.</div>}</div>
        <input type="checkbox" className="tick" checked={cfg.email} disabled={busy || !cfg.emailReady} onChange={e => save({ email: e.target.checked })} aria-label="Email me too" />
      </div>

      <div className="nrow">
        <b>Send it around</b>
        <select value={cfg.hour} disabled={busy} onChange={e => save({ hour: +e.target.value })} style={{ width: 'auto' }}>{cfg.hours.map(h => <option key={h} value={h}>{LABEL[h]}</option>)}</select>
      </div>

      <button className="ghostbtn" disabled={busy} onClick={test} style={{ marginTop: 6 }}>Send me a test now</button>
      {msg && <div className="hint" style={{ marginTop: 8 }}>{msg}</div>}
    </section>
  );
}
