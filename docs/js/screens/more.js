import { html, useState } from '../../vendor/preact-htm.js';
import { saveRelationshipStart } from '../events.js';
import { ROLES, partnerOf } from '../roles.js';
import { VERSION } from '../version.js';

/** 「更多」分頁：記帳、私密清單（之後做）、設定。 */
export function MoreScreen({ me, settings, onSwitchRole }) {
  const [editingStart, setEditingStart] = useState(false);

  function switchRole() {
    const other = ROLES[partnerOf(me)].name;
    if (confirm(`要從「${ROLES[me].name}」換成「${other}」嗎？`)) onSwitchRole();
  }

  return html`
    <div class="page">
      <h1>更多</h1>
      <div class="list">
        <div class="list-item">💰 個人記帳<small>第 6 步會做</small></div>
        <div class="list-item">🎁 私密清單<small>第 7 步會做</small></div>
      </div>
      <div class="list">
        <button class="list-item" onClick=${() => setEditingStart(true)}>
          💞 交往起始日<small>${settings.relationship_start || '還沒設定'}</small>
        </button>
        <button class="list-item" onClick=${switchRole}>🔄 切換身分<small>目前是 ${ROLES[me].name}</small></button>
      </div>
      <p class="version">版本 ${VERSION}</p>
      ${editingStart && html`<${StartForm} value=${settings.relationship_start} onClose=${() => setEditingStart(false)} />`}
    </div>
  `;
}

function StartForm({ value, onClose }) {
  const [date, setDate] = useState(value || '');
  function save(e) {
    e.preventDefault();
    if (date) saveRelationshipStart(date).catch(() => {});
    onClose();
  }
  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>💞 交往起始日</h2>
        <p class="hint">兩個人共用。每年這天會自動變成「交往紀念日」，提前兩週和當天提醒。</p>
        <label>日期<input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} required /></label>
        <div class="sheet-actions">
          <button type="button" class="btn ghost" onClick=${onClose}>取消</button>
          <button class="btn">儲存</button>
        </div>
      </form>
    </div>
  `;
}
