import { html, render, useEffect, useMemo, useState } from '../vendor/preact-htm.js';
import { signIn, isJoined, registerMember } from './firebase.js';
import { setupPush } from './push.js';
import { observeEvents, observeSettings, withRelationship } from './events.js';
import { syncReminders } from './reminders.js';
import { CalendarScreen } from './screens/calendar.js';
import { observeCourses } from './courses.js';
import { observePeriods } from './periods.js';
import { observeTodos } from './todos.js';
import { TodoScreen } from './screens/todo.js';
import { TimetableScreen } from './screens/timetable.js';
import { observePlaces } from './places.js';
import { onShared } from './share.js';
import { PlacesScreen } from './screens/places.js';
import { loadRole, saveRole, partnerOf } from './roles.js';
import { JoinScreen, RoleScreen } from './screens/setup.js';
import { HomeScreen } from './screens/home.js';
import { MoreScreen } from './screens/more.js';
import { PinGate } from './screens/pin.js';

const TABS = [
  { id: 'home', label: '首頁', icon: '🏠' },
  { id: 'calendar', label: '日曆', icon: '📅' },
  { id: 'timetable', label: '課表', icon: '📚' },
  { id: 'todo', label: '待辦', icon: '✅' },
  { id: 'places', label: '想去', icon: '📍' },
  { id: 'more', label: '更多', icon: '☰' },
];

function Main({ me, onSwitchRole }) {
  const [tab, setTab] = useState('home');
  const [pushState, setPushState] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [settings, setSettings] = useState({});
  useEffect(() => {
    setupPush(me).then(setPushState).catch(() => setPushState('denied'));
  }, [me]);
  useEffect(() => observeEvents(setRawEvents), []);
  useEffect(() => observeSettings(setSettings), []);
  const [courses, setCourses] = useState([]);
  useEffect(() => observeCourses(setCourses), []);
  const [periodsByRole, setPeriodsByRole] = useState({});
  useEffect(() => observePeriods(setPeriodsByRole), []);

  const [todos, setTodos] = useState([]);
  useEffect(() => observeTodos(setTodos), []);
  const [places, setPlaces] = useState([]);
  useEffect(() => observePlaces(setPlaces), []);

  // 從 IG 分享進來：切到「想去」並打開新增表單
  const [shared, setShared] = useState('');
  useEffect(() => onShared((text) => {
    setShared(text); // 想去頁會判斷是 IG 還是 Google 地圖
    setTab('places');
  }), []);

  const events = useMemo(() => withRelationship(rawEvents, settings), [rawEvents, settings]);
  // 行程或待辦一有變動就重排這支手機的提醒
  useEffect(() => { syncReminders(events, me, todos).catch(() => {}); }, [events, todos, me]);

  return html`
    ${tab === 'home' && html`<${HomeScreen} me=${me} pushState=${pushState} events=${events} courses=${courses} todos=${todos} settings=${settings} onOpenTab=${setTab} />`}
    ${tab === 'calendar' && html`<${CalendarScreen} me=${me} events=${events} />`}
    ${tab === 'timetable' && html`<${TimetableScreen} me=${me} courses=${courses} periodsByRole=${periodsByRole} />`}
    ${tab === 'todo' && html`<${TodoScreen} me=${me} todos=${todos} />`}
    ${tab === 'places' && html`<${PlacesScreen} me=${me} places=${places} shared=${shared} onSharedUsed=${() => setShared('')} />`}
    ${tab === 'more' && html`<${MoreScreen} me=${me} settings=${settings} onSwitchRole=${onSwitchRole} />`}
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
  const [pending, setPending] = useState(null);

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
    // 推播位址跟著「這支手機」走（devices/{uid}），換身分只會改這支手機的身分，不會動到對方
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
      return html`<${RoleScreen} onSelect=${(role) => { setPending(role); setPhase('verify'); }} />`;
    case 'verify':
      // 選的身分設過 PIN 的話要先輸入（沒設過就直接通過）
      return html`
        <div class="subpage-bar"><button class="icon-btn" onClick=${() => setPhase('role')}>‹</button><h1>確認身分</h1></div>
        <${PinGate} me=${pending} mode="verify" onDone=${() => choose(pending)} />`;
    default:
      return html`<${Main} me=${me} onSwitchRole=${() => choose(partnerOf(me))} />`;
  }
}

render(html`<${App} />`, document.getElementById('app'));
