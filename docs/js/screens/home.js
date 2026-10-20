import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { observeMembers } from '../firebase.js';
import { HEARTS, catchHeart, heartText, observeTodayHearts, sendHeart } from '../hearts.js';
import { MonthCard, useMonthlyCard } from './monthly.js';

const fmtTime = (ts) => {
  const d = ts?.toDate?.();
  return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '剛剛';
};
import { daysBetween, nextOccurrence, todayStr } from '../dates.js';
import { ROLES, partnerOf } from '../roles.js';
import { EventLine, itemsOn } from './calendar.js';
import { coursesOn, todayWeekday } from '../courses.js';
import { sortTodos } from '../todos.js';
import { TodoLine } from './todo.js';

const PUSH_TEXT = {
  denied: '🔕 通知被關掉了，請到手機設定 → 應用程式 → 小寶 → 通知 打開',
  web: '🌐 用瀏覽器開啟，收不到通知',
};

/** 最近的一個紀念日 */
function nextAnniversary(events, today) {
  return events
    .filter((ev) => ev.type === 'anniversary')
    .map((ev) => ({ ev, next: nextOccurrence(ev, today) }))
    .filter((x) => x.next)
    .sort((a, b) => a.next.date.localeCompare(b.next.date))[0];
}

export function HomeScreen({ me, pushState, events, courses, todos, settings, onOpenTab }) {
  const weekday = todayWeekday();
  const myTodos = sortTodos(todos.filter((t) => t.assignee === me && !t.done));
  const [members, setMembers] = useState({});
  const [sent, setSent] = useState('');
  useEffect(() => observeMembers(setMembers), []);

  const today = todayStr();
  const partner = ROLES[partnerOf(me)];
  const start = settings.relationship_start;
  const upcoming = nextAnniversary(events, today);
  const todayItems = itemsOn(events, today);

  const [hearts, setHearts] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => observeTodayHearts(setHearts), []);
  const recent = hearts.slice(0, 5); // 今天最近 5 顆（兩個方向都算）
  const [lastMonth, dismissMonth] = useMonthlyCard();

  async function send(kind, msg = '') {
    setSent('傳送中…');
    try {
      await sendHeart(me, kind, msg);
      setSent(`💌 已傳給${partner.name}`);
      if (kind === 'text') setText('');
    } catch (e) {
      setSent('傳送失敗：' + e.message);
    }
    setTimeout(() => setSent(''), 3000);
  }

  return html`
    <div class="page">
      <h1>嗨，${ROLES[me].name} 👋</h1>

      <div class="hero">
        ${start
          ? html`<div class="hero-big">💞 在一起第 ${daysBetween(start, today) + 1} 天</div>`
          : html`<button class="link" onClick=${() => onOpenTab('more')}>💞 設定交往起始日，就能看到在一起幾天</button>`}
        ${upcoming && html`
          <div>
            ${upcoming.next.date === today
              ? `🎉 今天是${upcoming.ev.title}${upcoming.next.years > 0 ? `（${upcoming.next.years} 週年）` : ''}！`
              : `❤️ ${upcoming.ev.title}${upcoming.next.years > 0 ? `（${upcoming.next.years} 週年）` : ''}還有 ${daysBetween(today, upcoming.next.date)} 天`}
          </div>`}
      </div>

      ${lastMonth && html`<${MonthCard} month=${lastMonth} onClose=${dismissMonth} />`}

      <h2 class="day-title">今天</h2>
      ${todayItems.length === 0 && html`<p class="hint">今天沒有安排</p>`}
      ${todayItems.map((ev) => html`<${EventLine} ev=${ev} dateStr=${today} onClick=${() => onOpenTab('calendar')} />`)}

      ${myTodos.length > 0 && html`
        <h2 class="day-title">我要做的（${myTodos.length}）</h2>
        ${myTodos.slice(0, 3).map((t) => html`<${TodoLine} todo=${t} me=${me} onOpen=${() => onOpenTab('todo')} />`)}
        ${myTodos.length > 3 && html`<button class="link" onClick=${() => onOpenTab('todo')}>看全部 ›</button>`}
      `}

      ${Object.values(ROLES).some((r) => coursesOn(courses, r.id, weekday).length) && html`
        <h2 class="day-title">今天的課</h2>
        <div class="card today-courses">
          ${Object.values(ROLES).map((r) => {
            const list = coursesOn(courses, r.id, weekday);
            return list.length > 0 && html`
              <div class="card-title">${r.name}</div>
              ${list.map((c) => html`
                <div class="today-course"><i style=${`background:${c.color}`}></i>${c.start_time}–${c.end_time} ${c.name}${c.location ? ` · ${c.location}` : ''}</div>
              `)}`;
          })}
        </div>`}

      <div class="card hearts ${partner.id}">
        <div class="card-title">💌 傳給${partner.name}${hearts.length > 0 ? html`<small>今天互傳了 ${hearts.length} 顆 💕</small>` : ''}</div>
        <div class="heart-grid">
          ${HEARTS.map((h) => html`<button onClick=${() => send(h.id)}><span>${h.emoji}</span>${h.label}</button>`)}
        </div>
        <form class="heart-text" onSubmit=${(e) => { e.preventDefault(); if (text.trim()) send('text', text.trim()); }}>
          <input value=${text} onInput=${(e) => setText(e.target.value)} maxLength="100" placeholder="自己打一句…" />
          <button class="btn" disabled=${!text.trim()}>傳送</button>
        </form>
        ${sent && html`<p class="hint" style="text-align:center;margin:0">${sent}</p>`}
        ${recent.length > 0 && html`
          <div class="received">
            ${recent.map((h) => {
              const mine = h.created_by === me;
              return html`
                <div class="heart-row">
                  <span><b class=${h.created_by}>${mine ? '我' : partner.name}</b> ${fmtTime(h.created_at)}　${heartText(h)}</span>
                  ${h.caught_by
                    ? html`<span class="caught">🤲 ${mine ? `${partner.name}接住了` : '已接住'}</span>`
                    : mine
                      ? html`<span class="caught waiting">還沒接住</span>`
                      : html`<button class="catch-btn" onClick=${() => catchHeart(h, me).catch(() => {})}>🤲 接住</button>`}
                </div>`;
            })}
          </div>`}
      </div>

      <div class="members">
        ${Object.values(ROLES).map((r) => html`
          <span>${r.name}${members[r.id] ? ' ✅' : ' ⏳'}</span>
        `)}
        ${PUSH_TEXT[pushState] && html`<span>${PUSH_TEXT[pushState]}</span>`}
      </div>
    </div>
  `;
}
