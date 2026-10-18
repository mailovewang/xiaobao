import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { observeMembers } from '../firebase.js';
import { ROLES } from '../roles.js';

const fmt = (ts) => {
  if (!ts) return '';
  const d = ts.toDate();
  return `（${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}）`;
};

export function HomeScreen({ me }) {
  const [members, setMembers] = useState({});
  useEffect(() => observeMembers(setMembers), []);

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
    </div>
  `;
}
