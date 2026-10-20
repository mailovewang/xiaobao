import { html, useState } from '../../vendor/preact-htm.js';
import { COURSE_COLORS, WEEKDAY_NAMES, addCourse, deleteCourse, todayWeekday, updateCourse } from '../courses.js';
import { DEFAULT_PERIODS, periodRange, savePeriods } from '../periods.js';
import { ROLES } from '../roles.js';

const EVENING = '18:00'; // 這之後開始的節次（夜間部），有課才顯示

/** 某人的節次，沒設定過就用預設 */
export const periodsOf = (periodsByRole, role) =>
  periodsByRole[role]?.length ? periodsByRole[role] : DEFAULT_PERIODS;

export function TimetableScreen({ me, courses, periodsByRole }) {
  const [owner, setOwner] = useState(me);
  const [editing, setEditing] = useState(null); // null | {} 新增 | course 編輯
  const [editingPeriods, setEditingPeriods] = useState(false);
  const mine = owner === me;
  const list = courses.filter((c) => c.owner === owner);
  const allPeriods = periodsOf(periodsByRole, owner);

  // 白天的節次都顯示；晚上的節次只顯示到最後一堂有課的那節
  const lastEvening = Math.max(-1, ...list.map((c) => periodRange(allPeriods, c.start_time, c.end_time)?.[1] ?? -1));
  const periods = allPeriods.filter((p, i) => p.start < EVENING || i <= lastEvening);

  // 平日一定顯示；週末有課才顯示
  const days = [1, 2, 3, 4, 5, ...[6, 7].filter((d) => list.some((c) => c.weekday === d))];
  const today = todayWeekday();
  const placed = list.map((c) => ({ c, range: periodRange(periods, c.start_time, c.end_time) }));
  const unplaced = placed.filter((x) => !x.range).map((x) => x.c);

  return html`
    <div class="page">
      <div class="month-bar">
        <h1>課表</h1>
        ${mine && html`<button class="chip-btn" onClick=${() => setEditingPeriods(true)}>⚙️ 節次</button>`}
      </div>
      <div class="segmented">
        ${Object.values(ROLES).map((r) => html`
          <button type="button" class=${owner === r.id ? 'on' : ''} onClick=${() => setOwner(r.id)}>${r.name}的課表</button>
        `)}
      </div>

      <div class="tt" style=${`grid-template-columns: 46px repeat(${days.length}, 1fr); grid-template-rows: auto repeat(${periods.length}, 60px)`}>
        <div></div>
        ${days.map((d, x) => html`<div class="tt-head ${d === today ? 'today' : ''}" style=${`grid-column:${x + 2}`}>${WEEKDAY_NAMES[d]}</div>`)}

        ${periods.map((p, y) => html`
          <div class="tt-period" style=${`grid-row:${y + 2}; grid-column:1`}>
            <b>${p.label.replace(/^第|節$/g, '')}</b><small>${p.start}</small><small>${p.end}</small>
          </div>
          ${days.map((d, x) => html`<div class="tt-cell ${d === today ? 'today' : ''}" style=${`grid-row:${y + 2}; grid-column:${x + 2}`}></div>`)}
        `)}

        ${placed.filter((x) => x.range && days.includes(x.c.weekday)).map(({ c, range }) => html`
          <button class="tt-course" onClick=${() => setEditing(c)}
            style=${`grid-row:${range[0] + 2} / ${range[1] + 3}; grid-column:${days.indexOf(c.weekday) + 2}; background:${c.color}`}>
            <b>${c.name}</b>
            ${c.location && html`<small>${c.location}</small>`}
          </button>
        `)}
      </div>

      ${unplaced.length > 0 && html`
        <h2 class="day-title">其他時段</h2>
        ${unplaced.map((c) => html`
          <button class="event-line" style=${`--c:${c.color}`} onClick=${() => setEditing(c)}>
            <span class="event-time">週${WEEKDAY_NAMES[c.weekday]}</span>
            <span class="event-title">${c.name}<small>${c.start_time}–${c.end_time}</small></span>
          </button>`)}
      `}

      ${list.length === 0 && html`<p class="hint" style="text-align:center">${mine ? '按右下角 ＋ 加入第一堂課' : `${ROLES[owner].name}還沒有填課表`}</p>`}
      ${mine && html`<button class="fab" onClick=${() => setEditing({})}>＋</button>`}
      ${editing && html`<${CourseForm} me=${me} course=${editing} periods=${periodsOf(periodsByRole, editing.owner ?? me)} onClose=${() => setEditing(null)} />`}
      ${editingPeriods && html`<${PeriodsForm} me=${me} periods=${allPeriods} onClose=${() => setEditingPeriods(false)} />`}
    </div>
  `;
}

function CourseForm({ me, course, periods, onClose }) {
  const isNew = !course.id;
  const readOnly = !isNew && course.owner !== me;
  const range = !isNew && periodRange(periods, course.start_time, course.end_time);
  const [f, setF] = useState({
    name: course.name ?? '',
    weekday: course.weekday ?? Math.min(todayWeekday(), 5),
    from: range ? range[0] : 0,
    to: range ? range[1] : 0,
    location: course.location ?? '',
    color: course.color ?? COURSE_COLORS[0],
  });
  const [error, setError] = useState('');
  const set = (k, num) => (e) => { const v = num ? Number(e.target.value) : e.target.value; setF((p) => ({ ...p, [k]: v })); };

  function save(e) {
    e.preventDefault();
    if (!f.name.trim()) return setError('請輸入課名');
    if (f.to < f.from) return setError('結束的節次不能比開始早');
    const data = {
      name: f.name.trim(), weekday: f.weekday, location: f.location, color: f.color,
      start_time: periods[f.from].start, end_time: periods[f.to].end,
    };
    // 先關掉表單：沒網路時資料會先存在手機，連上後自動上傳
    (isNew ? addCourse(data, me) : updateCourse(course.id, data)).catch(() => {});
    onClose();
  }

  function remove() {
    if (!confirm(`要刪除「${course.name}」嗎？`)) return;
    deleteCourse(course.id).catch(() => {});
    onClose();
  }

  const options = periods.map((p, i) => html`<option value=${i}>${p.label}（${p.start}–${p.end}）</option>`);

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '新增課程' : readOnly ? `${ROLES[course.owner]?.name}的課` : '編輯課程'}</h2>
        ${readOnly && html`<p class="hint">週${WEEKDAY_NAMES[course.weekday]} ${course.start_time}–${course.end_time}</p>`}
        <fieldset disabled=${readOnly}>
          <label>課名<input value=${f.name} onInput=${set('name')} placeholder="例如：微積分" /></label>
          <div>
            <div class="field-label">星期</div>
            <div class="chips">
              ${[1, 2, 3, 4, 5, 6, 7].map((d) => html`
                <button type="button" class=${f.weekday === d ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, weekday: d }))}>${WEEKDAY_NAMES[d]}</button>
              `)}
            </div>
          </div>
          <div class="row">
            <label>從<select value=${f.from} onChange=${set('from', true)}>${options}</select></label>
            <label>到<select value=${f.to} onChange=${set('to', true)}>${options}</select></label>
          </div>
          <label>教室／老師<input value=${f.location} onInput=${set('location')} /></label>
          <div>
            <div class="field-label">顏色</div>
            <div class="swatches">
              ${COURSE_COLORS.map((c) => html`
                <button type="button" class=${f.color === c ? 'on' : ''} style=${`background:${c}`} onClick=${() => setF((p) => ({ ...p, color: c }))}></button>
              `)}
            </div>
          </div>
        </fieldset>
        ${error && html`<p class="error">${error}</p>`}
        <div class="sheet-actions">
          ${!isNew && !readOnly && html`<button type="button" class="btn ghost danger" onClick=${remove}>刪除</button>`}
          <button type="button" class="btn ghost" onClick=${onClose}>${readOnly ? '關閉' : '取消'}</button>
          ${!readOnly && html`<button class="btn">儲存</button>`}
        </div>
      </form>
    </div>
  `;
}

/** 設定自己學校的節次 */
function PeriodsForm({ me, periods, onClose }) {
  const [rows, setRows] = useState(periods.map((p) => ({ ...p })));
  const [error, setError] = useState('');
  const edit = (i, k) => (e) => { const v = e.target.value; setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r))); };

  function save(e) {
    e.preventDefault();
    const bad = rows.find((r) => !r.label.trim() || !r.start || !r.end || r.end <= r.start);
    if (bad) return setError(`「${bad.label || '未命名'}」的名稱或時間不對`);
    savePeriods(me, rows.map((r) => ({ ...r, label: r.label.trim() }))).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>⚙️ ${ROLES[me].name}的節次</h2>
        <p class="hint">照你學校的上課時間設定，課表會一節一格顯示。已經填的課不會被改到。</p>
        ${rows.map((r, i) => html`
          <div class="period-row">
            <input value=${r.label} onInput=${edit(i, 'label')} />
            <input type="time" value=${r.start} onInput=${edit(i, 'start')} />
            <input type="time" value=${r.end} onInput=${edit(i, 'end')} />
            <button type="button" class="icon-btn" onClick=${() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
          </div>
        `)}
        <button type="button" class="btn ghost" style="max-width:none"
          onClick=${() => setRows((rs) => [...rs, { label: `第${rs.length + 1}節`, start: '', end: '' }])}>＋ 新增一節</button>
        ${error && html`<p class="error">${error}</p>`}
        <div class="sheet-actions">
          <button type="button" class="btn ghost" onClick=${() => setRows(DEFAULT_PERIODS.map((p) => ({ ...p })))}>重設</button>
          <button type="button" class="btn ghost" onClick=${onClose}>取消</button>
          <button class="btn">儲存</button>
        </div>
      </form>
    </div>
  `;
}
