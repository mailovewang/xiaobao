import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { observeMembers, sendPing } from '../firebase.js';
import { ROLES, partnerOf } from '../roles.js';

const fmt = (ts) => {
  if (!ts) return '';
  const d = ts.toDate();
  return `（${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}）`;
};

const PUSH_TEXT = {
  ok: '🔔 通知已開啟',
  denied: '🔕 通知被關掉了，請到手機設定 → 應用程式 → 小寶 → 通知 打開',
  web: '🌐 用瀏覽器開啟，收不到通知',
};

export function HomeScreen({ me, pushState }) {
  const [members, setMembers] = useState({});
  const [sent, setSent] = useState('');
  useEffect(() => observeMembers(setMembers), []);

  const partner = ROLES[partnerOf(me)];

  async function ping() {
    setSent('傳送中…');
    try {
      await sendPing(me);
      setSent(`💌 已傳給${partner.name}`);
    } catch (e) {
      setSent('傳送失敗：' + e.message);
    }
    setTimeout(() => setSent(''), 3000);
  }

  return html`
    <div class="page">
      <h1>嗨，${ROLES[me].name} 👋</h1>
      ${Object.values(ROLES).map((r) => {
        const info = members[r.id];
        return html`
          <div class="card ${r.id}">
            <div class="card-title">${r.name}${r.id === me ? '（我）' : ''}</div>
            <div>${info ? `✅ 已加入${fmt(info.updated_at)}` : '⏳ 還沒打開 App'}</div>
          </div>
        `;
      })}
      <button class="btn ${partner.id}" style="max-width:none" onClick=${ping}>💌 傳一顆愛心給${partner.name}</button>
      ${sent && html`<p class="hint" style="text-align:center">${sent}</p>`}
      ${pushState && html`<p class="hint" style="text-align:center">${PUSH_TEXT[pushState] ?? ''}</p>`}
    </div>
  `;
}
