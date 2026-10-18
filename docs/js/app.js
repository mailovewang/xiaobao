import { html, render, useEffect, useState } from '../vendor/preact-htm.js';
import { signIn, isJoined, registerMember } from './firebase.js';
import { loadRole, saveRole, partnerOf } from './roles.js';
import { JoinScreen, RoleScreen } from './screens/setup.js';
import { HomeScreen } from './screens/home.js';
import { MoreScreen } from './screens/more.js';

const TABS = [
  { id: 'home', label: '首頁', icon: '🏠' },
  { id: 'calendar', label: '日曆', icon: '📅' },
  { id: 'timetable', label: '課表', icon: '📚' },
  { id: 'todo', label: '待辦', icon: '✅' },
  { id: 'more', label: '更多', icon: '☰' },
];

function ComingSoon({ name, step }) {
  return html`<p class="soon">${name}：${step} 會做 🚧</p>`;
}

function Main({ me, onSwitchRole }) {
  const [tab, setTab] = useState('home');
  return html`
    ${tab === 'home' && html`<${HomeScreen} me=${me} />`}
    ${tab === 'calendar' && html`<${ComingSoon} name="日曆" step="第 3 步" />`}
    ${tab === 'timetable' && html`<${ComingSoon} name="課表" step="第 4 步" />`}
    ${tab === 'todo' && html`<${ComingSoon} name="待辦" step="第 5 步" />`}
    ${tab === 'more' && html`<${MoreScreen} me=${me} onSwitchRole=${onSwitchRole} />`}
    <nav class="nav">
      ${TABS.map((t) => html`
        <button class=${tab === t.id ? 'active' : ''} onClick=${() => setTab(t.id)}>
          <span class="icon">${t.icon}</span>${t.label}
        </button>
      `)}
    </nav>
  `;
}

function App() {
  // loading → join（輸入暗號）→ role（選身分）→ main
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [me, setMe] = useState(loadRole());

  async function start() {
    setPhase('loading');
    setError('');
    try {
      await signIn();
      if (!(await isJoined())) return setPhase('join');
      const role = loadRole();
      if (!role) return setPhase('role');
      registerMember(role).catch(() => {}); // 沒網路時等連上再送
      setPhase('main');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }
  useEffect(() => { start(); }, []);

  function choose(role) {
    saveRole(role);
    setMe(role);
    registerMember(role).catch(() => {});
    setPhase('main');
  }

  switch (phase) {
    case 'loading':
      return html`<div class="center"><div class="spinner"></div></div>`;
    case 'error':
      return html`
        <div class="center">
          <div class="big-emoji">😢</div>
          <p class="error">連不上伺服器：${error}</p>
          <button class="btn" onClick=${start}>重試</button>
        </div>`;
    case 'join':
      return html`<${JoinScreen} onJoined=${() => (loadRole() ? choose(loadRole()) : setPhase('role'))} />`;
    case 'role':
      return html`<${RoleScreen} onSelect=${choose} />`;
    default:
      return html`<${Main} me=${me} onSwitchRole=${() => choose(partnerOf(me))} />`;
  }
}

render(html`<${App} />`, document.getElementById('app'));
