import { html, useState } from '../../vendor/preact-htm.js';
import { saveRelationshipStart } from '../events.js';
import { lock } from '../pin.js';
import { ROLES, partnerOf } from '../roles.js';
import { VERSION } from '../version.js';
import { LedgerScreen } from './ledger.js';
import { PinGate } from './pin.js';
import { SecretsScreen } from './secrets.js';

/** 「更多」分頁：記帳、私密清單、設定。 */
export function MoreScreen({ me, settings, onSwitchRole }) {
  const [page, setPage] = useState(null); // null | 'ledger' | 'secrets' | 'change-pin'
  const [editingStart, setEditingStart] = useState(false);
  const [toast, setToast] = useState('');

  function switchRole() {
    const other = ROLES[partnerOf(me)].name;
    if (!confirm(`要從「${ROLES[me].name}」換成「${other}」嗎？`)) return;
    lock();
    setPage('switch'); // 對方設過 PIN 的話，要先輸入對方的 PIN
  }

  const back = () => setPage(null);

  // 連點版本號 5 下：切換測試版（給麥麥先試新功能用）
  const isBeta = location.pathname.includes('/beta/');
  const [taps, setTaps] = useState(0);
  function tapVersion() {
    if (taps + 1 < 5) return setTaps(taps + 1);
    setTaps(0);
    if (!confirm(isBeta ? '要切回正式版嗎？' : '要切到測試版嗎？（會先看到還沒正式發布的新功能）')) return;
    try { localStorage.setItem('channel', isBeta ? 'stable' : 'beta'); } catch {}
    location.replace(isBeta ? '../' : 'beta/');
  }
  const bar = (title) => html`
    <div class="subpage-bar">
      <button class="icon-btn" onClick=${back}>‹</button>
      <h1>${title}</h1>
    </div>`;

  if (page === 'ledger') {
    return html`${bar('💰 個人記帳')}<${PinGate} me=${me}><${LedgerScreen} me=${me} /></${PinGate}>`;
  }
  if (page === 'secrets') {
    return html`${bar('🎁 私密清單')}<${PinGate} me=${me}><${SecretsScreen} me=${me} /></${PinGate}>`;
  }
  if (page === 'switch') {
    return html`${bar('🔄 切換身分')}<${PinGate} me=${partnerOf(me)} mode="verify" onDone=${onSwitchRole} />`;
  }
  if (page === 'change-pin') {
    return html`${bar('🔒 更改 PIN')}<${PinGate} me=${me} mode="change"
      onDone=${() => { back(); setToast('PIN 已更新'); setTimeout(() => setToast(''), 2500); }} />`;
  }

  return html`
    <div class="page">
      <h1>更多</h1>
      <div class="list">
        <button class="list-item" onClick=${() => setPage('ledger')}>💰 個人記帳<small>只有自己看得到，需要 PIN</small></button>
        <button class="list-item" onClick=${() => setPage('secrets')}>🎁 私密清單<small>驚喜、禮物、想法，只有自己看得到</small></button>
      </div>
      <div class="list">
        <button class="list-item" onClick=${() => setEditingStart(true)}>
          💞 交往起始日<small>${settings.relationship_start || '還沒設定'}</small>
        </button>
        <button class="list-item" onClick=${() => setPage('change-pin')}>🔒 更改 PIN<small>記帳和私密清單共用</small></button>
        <button class="list-item" onClick=${switchRole}>🔄 切換身分<small>目前是 ${ROLES[me].name}</small></button>
      </div>
      ${toast && html`<p class="hint" style="text-align:center">✅ ${toast}</p>`}
      <p class="version" onClick=${tapVersion}>版本 ${VERSION}${isBeta ? '（測試版）' : ''}</p>
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
