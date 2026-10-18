import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { SECRET_TYPES, addSecret, deleteSecret, observeMySecrets, typeOf, updateSecret } from '../secrets.js';
import { daysBetween, todayStr } from '../dates.js';
import { ROLES, partnerOf } from '../roles.js';

function countdown(date) {
  if (!date) return '';
  const n = daysBetween(todayStr(), date);
  if (n > 0) return `還有 ${n} 天`;
  if (n === 0) return '就是今天！';
  return `已過 ${-n} 天`;
}

export function SecretsScreen({ me }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => observeMySecrets(me, setItems), [me]);

  const shown = items.filter((x) => filter === 'all' || x.type === filter);
  // 有日期的照日期排在前面，沒日期的放後面
  const open = shown.filter((x) => !x.done)
    .sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'));
  const done = shown.filter((x) => x.done);

  const line = (x) => {
    const t = typeOf(x.type);
    const cd = countdown(x.target_date);
    return html`
      <div class="todo-line secret ${x.done ? 'done' : ''}">
        <button class="todo-check" aria-label="完成" onClick=${() => updateSecret(x.id, { done: !x.done }).catch(() => {})}>${x.done ? '✓' : ''}</button>
        <button class="todo-body" onClick=${() => setEditing(x)}>
          ${t.icon} ${x.title}
          ${(x.target_date || x.note) && html`<small>${x.target_date ? `📅 ${x.target_date.slice(5).replace('-', '/')} · ${cd}` : ''}${x.target_date && x.note ? ' · ' : ''}${x.note}</small>`}
        </button>
      </div>`;
  };

  return html`
    <div class="page">
      <p class="hint">🤫 只有你看得到，${ROLES[partnerOf(me)].name}不會收到任何通知</p>
      <div class="chips wrap">
        <button type="button" class=${filter === 'all' ? 'on' : ''} onClick=${() => setFilter('all')}>全部</button>
        ${SECRET_TYPES.map((t) => html`<button type="button" class=${filter === t.id ? 'on' : ''} onClick=${() => setFilter(t.id)}>${t.icon} ${t.label}</button>`)}
      </div>

      ${open.length === 0 && html`<p class="hint" style="text-align:center">還沒有東西，按 ＋ 記下想送的禮物、想準備的驚喜，或${ROLES[partnerOf(me)].name}說過想要的東西</p>`}
      ${open.map(line)}

      ${done.length > 0 && html`
        <button class="link" style="margin-top:8px" onClick=${() => setShowDone(!showDone)}>${showDone ? '▾' : '▸'} 已完成（${done.length}）</button>
        ${showDone && done.map(line)}
      `}

      <button class="fab" onClick=${() => setEditing({ type: filter === 'all' ? 'gift' : filter })}>＋</button>
      ${editing && html`<${SecretForm} me=${me} item=${editing} onClose=${() => setEditing(null)} />`}
    </div>
  `;
}

function SecretForm({ me, item, onClose }) {
  const isNew = !item.id;
  const [f, setF] = useState({
    type: item.type ?? 'gift',
    title: item.title ?? '',
    target_date: item.target_date ?? '',
    note: item.note ?? '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };

  function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return setError('請輸入內容');
    const data = { ...f, title: f.title.trim(), note: f.note.trim() };
    (isNew ? addSecret(data, me) : updateSecret(item.id, data)).catch(() => {});
    onClose();
  }

  function remove() {
    if (!confirm(`要刪除「${item.title}」嗎？`)) return;
    deleteSecret(item.id).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '新增' : '編輯'}</h2>
        <div class="segmented">
          ${SECRET_TYPES.map((t) => html`<button type="button" class=${f.type === t.id ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, type: t.id }))}>${t.icon} ${t.label}</button>`)}
        </div>
        <label>內容<input value=${f.title} onInput=${set('title')} placeholder=${f.type === 'idea' ? '例如：她說想要那款香水' : '例如：生日送手鍊'} /></label>
        <label>目標日期（可不填）<input type="date" value=${f.target_date} onInput=${set('target_date')} /></label>
        <label>備註<textarea rows="3" value=${f.note} onInput=${set('note')} placeholder="預算、在哪裡買、尺寸…"></textarea></label>
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
