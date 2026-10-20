import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { WEEKDAYS, occursOn, prettyDate, toDateStr, todayStr, nextOccurrence } from '../dates.js';
import { addEvent, deleteEvent, updateEvent } from '../events.js';
import { askExact, checkExact } from '../reminders.js';
import { ROLES } from '../roles.js';

const colorOf = (ev) => (ev.type === 'anniversary' ? 'anniversary' : ev.owner);

/** 某天的項目：紀念日排前面，再依時間排。 */
export function itemsOn(events, dateStr) {
  return events
    .filter((ev) => occursOn(ev, dateStr))
    .sort((a, b) => (a.type === b.type ? (a.start_time || '').localeCompare(b.start_time || '') : a.type === 'anniversary' ? -1 : 1));
}

export function EventLine({ ev, dateStr, onClick }) {
  const years = ev.type === 'anniversary' ? nextOccurrence(ev, dateStr)?.years : 0;
  const time = ev.type === 'anniversary' ? '❤️' : ev.all_day || !ev.start_time ? '整天' : ev.start_time + (ev.end_time ? `–${ev.end_time}` : '');
  return html`
    <button class="event-line ${colorOf(ev)}" onClick=${onClick}>
      <span class="event-time">${time}</span>
      <span class="event-title">
        ${ev.title}${years > 0 ? `（${years} 週年）` : ''}
        <small>${ev.type === 'anniversary' ? '紀念日' : ROLES[ev.owner]?.name}${ev.location ? ` · 📍${ev.location}` : ''}</small>
      </span>
    </button>
  `;
}

export function CalendarScreen({ me, events }) {
  const today = todayStr();
  const [month, setMonth] = useState(() => today.slice(0, 7)); // 'YYYY-MM'
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState(null); // null | {} 新增 | event 編輯
  const [exact, setExact] = useState(null);
  useEffect(() => { checkExact().then(setExact); }, []);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(y, m - 1, i + 1))),
  ];
  const shift = (n) => {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(toDateStr(d).slice(0, 7));
  };

  const dayItems = itemsOn(events, selected);

  return html`
    <div class="page">
      <div class="month-bar">
        <button class="icon-btn" onClick=${() => shift(-1)}>‹</button>
        <h1>${y} 年 ${m} 月</h1>
        <button class="icon-btn" onClick=${() => shift(1)}>›</button>
      </div>

      ${exact === false && html`
        <button class="notice" onClick=${() => askExact().then(setExact)}>
          ⏰ 點這裡允許「鬧鐘與提醒」，提醒才會準時
        </button>`}

      <div class="cal">
        ${WEEKDAYS.map((w) => html`<div class="cal-head">${w}</div>`)}
        ${cells.map((d) => {
          if (!d) return html`<div></div>`;
          const items = itemsOn(events, d);
          return html`
            <button class="cal-day ${d === today ? 'today' : ''} ${d === selected ? 'selected' : ''}" onClick=${() => setSelected(d)}>
              <span>${Number(d.slice(8))}</span>
              <span class="dots">${items.slice(0, 3).map((ev) => html`<i class=${colorOf(ev)}></i>`)}</span>
            </button>`;
        })}
      </div>

      <h2 class="day-title">${prettyDate(selected)}</h2>
      ${dayItems.length === 0 && html`<p class="hint">這天沒有安排</p>`}
      ${dayItems.map((ev) => html`<${EventLine} ev=${ev} dateStr=${selected} onClick=${() => setEditing(ev)} />`)}

      <button class="fab" onClick=${() => setEditing({})}>＋</button>
      ${editing && html`<${EventForm} me=${me} ev=${editing} defaultDate=${selected} onClose=${() => setEditing(null)} />`}
    </div>
  `;
}

function EventForm({ me, ev, defaultDate, onClose }) {
  const isNew = !ev.id;
  // 行程只有本人能改；紀念日兩人都能改；交往紀念日要到「更多」改
  const readOnly = ev.virtual || (ev.type === 'event' && ev.owner !== me);
  const [f, setF] = useState({
    type: ev.type ?? 'event',
    title: ev.title ?? '',
    date: ev.date ?? defaultDate,
    all_day: ev.all_day ?? false,
    start_time: ev.start_time ?? '',
    end_time: ev.end_time ?? '',
    location: ev.location ?? '',
    note: ev.note ?? '',
    repeat_yearly: ev.repeat_yearly ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF((p) => ({ ...p, [k]: v })); };

  async function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return setError('請輸入名稱');
    if (f.type === 'event' && !f.all_day && !f.start_time) return setError('請選開始時間，或勾「整天」');
    const data = f.type === 'anniversary'
      ? { type: 'anniversary', owner: 'shared', title: f.title.trim(), date: f.date, repeat_yearly: f.repeat_yearly, note: f.note }
      : { type: 'event', owner: ev.owner ?? me, title: f.title.trim(), date: f.date, all_day: f.all_day,
          start_time: f.all_day ? '' : f.start_time, end_time: f.all_day ? '' : f.end_time, location: f.location, note: f.note };
    setBusy(true);
    try {
      // 先關掉表單：沒網路時資料會先存在手機，連上後自動上傳
      const pending = isNew ? addEvent(data, me) : updateEvent(ev.id, data);
      onClose();
      await pending;
    } catch (err) {
      setError('儲存失敗：' + err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`要刪除「${ev.title}」嗎？`)) return;
    deleteEvent(ev.id).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '新增' : readOnly ? '查看' : '編輯'}</h2>
        ${ev.virtual && html`<p class="hint">交往紀念日請到「更多 → 交往起始日」修改</p>`}
        ${readOnly && !ev.virtual && html`<p class="hint">這是${ROLES[ev.owner]?.name}的行程，只有${ROLES[ev.owner]?.name}能修改</p>`}

        ${isNew && html`
          <div class="segmented">
            <button type="button" class=${f.type === 'event' ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, type: 'event' }))}>📅 行程</button>
            <button type="button" class=${f.type === 'anniversary' ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, type: 'anniversary' }))}>❤️ 紀念日</button>
          </div>`}

        <fieldset disabled=${readOnly || busy}>
          <label>名稱<input value=${f.title} onInput=${set('title')} placeholder=${f.type === 'event' ? '例如：看電影' : '例如：第一次約會'} /></label>
          <label>日期<input type="date" value=${f.date} onInput=${set('date')} required /></label>

          ${f.type === 'event' ? html`
            <label class="check"><input type="checkbox" checked=${f.all_day} onChange=${set('all_day')} /> 整天</label>
            ${!f.all_day && html`
              <div class="row">
                <label>開始<input type="time" value=${f.start_time} onInput=${set('start_time')} /></label>
                <label>結束<input type="time" value=${f.end_time} onInput=${set('end_time')} /></label>
              </div>`}
            <label>地點<input value=${f.location} onInput=${set('location')} /></label>
            <p class="hint">⏰ 前一天會提醒你自己</p>
          ` : html`
            <label class="check"><input type="checkbox" checked=${f.repeat_yearly} onChange=${set('repeat_yearly')} /> 每年重複</label>
            <p class="hint">⏰ 提前兩週和當天早上 9 點，兩個人都會收到提醒</p>
          `}
          <label>備註<textarea rows="2" value=${f.note} onInput=${set('note')}></textarea></label>
        </fieldset>

        ${error && html`<p class="error">${error}</p>`}
        <div class="sheet-actions">
          ${!isNew && !readOnly && html`<button type="button" class="btn ghost danger" onClick=${remove}>刪除</button>`}
          <button type="button" class="btn ghost" onClick=${onClose}>${readOnly ? '關閉' : '取消'}</button>
          ${!readOnly && html`<button class="btn" disabled=${busy}>儲存</button>`}
        </div>
      </form>
    </div>
  `;
}
