import { html, useState } from '../../vendor/preact-htm.js';
import { COURSE_COLORS, WEEKDAY_NAMES, addCourse, deleteCourse, todayWeekday, updateCourse } from '../courses.js';
import { ROLES } from '../roles.js';

const HOUR_PX = 56;
const toHours = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
};

export function TimetableScreen({ me, courses }) {
  const [owner, setOwner] = useState(me);
  const [editing, setEditing] = useState(null); // null | {} 新增 | course 編輯
  const mine = owner === me;
  const list = courses.filter((c) => c.owner === owner);

  // 平日一定顯示；週末有課才顯示
  const days = [1, 2, 3, 4, 5, ...[6, 7].filter((d) => list.some((c) => c.weekday === d))];
  // 時間範圍：至少 8–18 點，有更早或更晚的課就延伸
  const startHour = Math.min(8, ...list.map((c) => Math.floor(toHours(c.start_time))));
  const endHour = Math.max(18, ...list.map((c) => Math.ceil(toHours(c.end_time))));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const today = todayWeekday();

  return html`
    <div class="page">
      <h1>課表</h1>
      <div class="segmented">
        ${Object.values(ROLES).map((r) => html`
          <button type="button" class=${owner === r.id ? 'on' : ''} onClick=${() => setOwner(r.id)}>${r.name}的課表</button>
        `)}
      </div>

      <div class="tt" style=${`grid-template-columns: 36px repeat(${days.length}, 1fr)`}>
        <div></div>
        ${days.map((d) => html`<div class="tt-head ${d === today ? 'today' : ''}">${WEEKDAY_NAMES[d]}</div>`)}

        <div class="tt-hours" style=${`height:${hours.length * HOUR_PX}px`}>
          ${hours.map((h) => html`<div style=${`height:${HOUR_PX}px`}>${h}</div>`)}
        </div>
        ${days.map((d) => html`
          <div class="tt-col ${d === today ? 'today' : ''}" style=${`height:${hours.length * HOUR_PX}px; background-size: 100% ${HOUR_PX}px`}>
            ${list.filter((c) => c.weekday === d).map((c) => html`
              <button class="tt-course" onClick=${() => setEditing(c)}
                style=${`top:${(toHours(c.start_time) - startHour) * HOUR_PX}px; height:${(toHours(c.end_time) - toHours(c.start_time)) * HOUR_PX - 2}px; background:${c.color}`}>
                <b>${c.name}</b>
                ${c.location && html`<small>${c.location}</small>`}
              </button>
            `)}
          </div>
        `)}
      </div>

      ${list.length === 0 && html`<p class="hint" style="text-align:center">${mine ? '按右下角 ＋ 加入第一堂課' : `${ROLES[owner].name}還沒有填課表`}</p>`}
      ${mine && html`<button class="fab" onClick=${() => setEditing({})}>＋</button>`}
      ${editing && html`<${CourseForm} me=${me} course=${editing} onClose=${() => setEditing(null)} />`}
    </div>
  `;
}

function CourseForm({ me, course, onClose }) {
  const isNew = !course.id;
  const readOnly = !isNew && course.owner !== me;
  const [f, setF] = useState({
    name: course.name ?? '',
    weekday: course.weekday ?? Math.min(todayWeekday(), 5),
    start_time: course.start_time ?? '',
    end_time: course.end_time ?? '',
    location: course.location ?? '',
    color: course.color ?? COURSE_COLORS[0],
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };

  function save(e) {
    e.preventDefault();
    if (!f.name.trim()) return setError('請輸入課名');
    if (!f.start_time || !f.end_time) return setError('請選上課和下課時間');
    if (f.end_time <= f.start_time) return setError('下課時間要比上課時間晚');
    const data = { ...f, name: f.name.trim() };
    // 先關掉表單：沒網路時資料會先存在手機，連上後自動上傳
    (isNew ? addCourse(data, me) : updateCourse(course.id, data)).catch(() => {});
    onClose();
  }

  function remove() {
    if (!confirm(`要刪除「${course.name}」嗎？`)) return;
    deleteCourse(course.id).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '新增課程' : readOnly ? `${ROLES[course.owner]?.name}的課` : '編輯課程'}</h2>
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
            <label>上課<input type="time" value=${f.start_time} onInput=${set('start_time')} /></label>
            <label>下課<input type="time" value=${f.end_time} onInput=${set('end_time')} /></label>
          </div>
          <label>教室<input value=${f.location} onInput=${set('location')} /></label>
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
