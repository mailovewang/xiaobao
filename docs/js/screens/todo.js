import { html, useState } from '../../vendor/preact-htm.js';
import { addTodo, deleteTodo, setDone, sortTodos, updateTodo } from '../todos.js';
import { ROLES, partnerOf } from '../roles.js';

/** 'YYYY-MM-DDTHH:mm' → '10/20 15:00' */
const fmtRemind = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} ${s.slice(11, 16)}`;
const nowLocal = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const TABS = [
  { id: 'mine', label: '我要做的', filter: (t, me) => t.assignee === me },
  { id: 'assigned', label: '我交代的', filter: (t, me) => t.created_by === me && t.assignee !== me },
  { id: 'all', label: '全部', filter: () => true },
];

export function TodoLine({ todo, me, onOpen }) {
  const from = todo.created_by !== todo.assignee ? `${ROLES[todo.created_by]?.name}交代${ROLES[todo.assignee]?.name}` : ROLES[todo.assignee]?.name;
  const late = !todo.done && todo.remind_at && todo.remind_at < nowLocal();
  return html`
    <div class="todo-line ${todo.done ? 'done' : ''} ${todo.assignee}">
      <button class="todo-check" aria-label="完成" onClick=${() => setDone(todo, !todo.done, me).catch(() => {})}>${todo.done ? '✓' : ''}</button>
      <button class="todo-body" onClick=${() => onOpen(todo)}>
        ${todo.title}
        <small>${from}${todo.remind_at ? html` · <span class=${late ? 'late' : ''}>⏰ ${fmtRemind(todo.remind_at)}</span>` : ''}</small>
      </button>
    </div>
  `;
}

export function TodoScreen({ me, todos }) {
  const [tab, setTab] = useState('mine');
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);

  const filter = TABS.find((t) => t.id === tab).filter;
  const list = todos.filter((t) => filter(t, me));
  const open = sortTodos(list.filter((t) => !t.done));
  const done = list.filter((t) => t.done).sort((a, b) => (b.done_at?.seconds ?? 0) - (a.done_at?.seconds ?? 0));

  return html`
    <div class="page">
      <h1>待辦</h1>
      <div class="segmented">
        ${TABS.map((t) => html`<button type="button" class=${tab === t.id ? 'on' : ''} onClick=${() => setTab(t.id)}>${t.label}</button>`)}
      </div>

      ${open.length === 0 && html`<p class="hint" style="text-align:center">${tab === 'assigned' ? `還沒有交代${ROLES[partnerOf(me)].name}任何事` : '沒有待辦，好棒 🎉'}</p>`}
      ${open.map((t) => html`<${TodoLine} todo=${t} me=${me} onOpen=${setEditing} />`)}

      ${done.length > 0 && html`
        <button class="link" style="margin-top:8px" onClick=${() => setShowDone(!showDone)}>
          ${showDone ? '▾' : '▸'} 已完成（${done.length}）
        </button>
        ${showDone && done.map((t) => html`<${TodoLine} todo=${t} me=${me} onOpen=${setEditing} />`)}
      `}

      <button class="fab" onClick=${() => setEditing({ assignee: tab === 'assigned' ? partnerOf(me) : me })}>＋</button>
      ${editing && html`<${TodoForm} me=${me} todo=${editing} onClose=${() => setEditing(null)} />`}
    </div>
  `;
}

function TodoForm({ me, todo, onClose }) {
  const isNew = !todo.id;
  const [f, setF] = useState({
    title: todo.title ?? '',
    assignee: todo.assignee ?? me,
    remind_at: todo.remind_at ?? '',
    note: todo.note ?? '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };
  const partner = ROLES[partnerOf(me)];

  function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return setError('請輸入要做什麼');
    const data = { ...f, title: f.title.trim() };
    // 先關掉表單：沒網路時資料會先存在手機，連上後自動上傳
    (isNew ? addTodo(data, me) : updateTodo(todo.id, data)).catch(() => {});
    onClose();
  }

  function remove() {
    if (!confirm(`要刪除「${todo.title}」嗎？`)) return;
    deleteTodo(todo.id).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '新增待辦' : '編輯待辦'}</h2>
        ${!isNew && todo.created_by !== me && html`<p class="hint">${ROLES[todo.created_by]?.name}交代的</p>`}
        <label>要做什麼<input value=${f.title} onInput=${set('title')} placeholder="例如：幫她買珍奶" /></label>
        <div>
          <div class="field-label">誰要做</div>
          <div class="segmented">
            <button type="button" class=${f.assignee === me ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, assignee: me }))}>我自己</button>
            <button type="button" class=${f.assignee !== me ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, assignee: partner.id }))}>交代${partner.name}</button>
          </div>
        </div>
        <label>
          提醒時間（可不填）
          <input type="datetime-local" value=${f.remind_at} onInput=${set('remind_at')} />
        </label>
        ${f.remind_at && html`<button type="button" class="link" onClick=${() => setF((p) => ({ ...p, remind_at: '' }))}>✕ 不要提醒</button>`}
        <p class="hint">⏰ 時間到會提醒${f.assignee === me ? '你' : partner.name}${f.assignee !== me ? `；新增時${partner.name}也會馬上收到通知` : ''}</p>
        <label>備註<textarea rows="2" value=${f.note} onInput=${set('note')}></textarea></label>
        ${error && html`<p class="error">${error}</p>`}
        <div class="sheet-actions">
          ${!isNew && html`<button type="button" class="btn ghost danger" onClick=${remove}>刪除</button>`}
          <button type="button" class="btn ghost" onClick=${onClose}>取消</button>
          <button class="btn">儲存</button>
        </div>
      </form>
    </div>
  `;
}
