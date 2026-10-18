import { html } from '../../vendor/preact-htm.js';
import { ROLES, partnerOf } from '../roles.js';
import { VERSION } from '../version.js';

/** 「更多」分頁：記帳、私密清單（之後做）、設定。 */
export function MoreScreen({ me, onSwitchRole }) {
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
        <button class="list-item" onClick=${switchRole}>🔄 切換身分<small>目前是 ${ROLES[me].name}</small></button>
      </div>
      <p class="version">版本 ${VERSION}</p>
    </div>
  `;
}
