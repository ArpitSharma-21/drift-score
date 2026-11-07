import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// If anything in the app ever throws, show a way out instead of a blank page.
class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ maxWidth: 420, margin: '18vh auto', padding: 24 }}>
        <h2>Something went wrong</h2>
        <p style={{ color: '#6a7480' }}>Reload the page. If it keeps happening, log out and sign in again.</p>
        <button onClick={() => location.reload()} style={{ marginRight: 8 }}>Reload</button>
        <button onClick={() => { localStorage.removeItem('token'); location.reload(); }}>Log out</button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>);

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
