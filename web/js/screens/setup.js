// 第一次打開：輸入暗號 → 選身分
import { html, useState } from '../../vendor/preact-htm.js';
import { join } from '../firebase.js';
import { ROLES } from '../roles.js';

export function JoinScreen({ onJoined }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (await join(code.trim())) onJoined();
      else setError('暗號不對喔 🙅');
    } catch (err) {
      setError('連線失敗：' + err.message);
    }
    setBusy(false);
  }

  return html`
    <form class="center" onSubmit=${submit}>
      <div class="big-emoji">🔐</div>
      <h1 class="title">請輸入暗號</h1>
      <p class="hint">只有第一次需要輸入</p>
      <input class="code-input" type="password" inputmode="numeric" autocomplete="off"
        value=${code} onInput=${(e) => setCode(e.target.value)} />
      ${error && html`<p class="error">${error}</p>`}
      <button class="btn" disabled=${busy || !code.trim()}>${busy ? '確認中…' : '進入'}</button>
    </form>
  `;
}

export function RoleScreen({ onSelect }) {
  return html`
    <div class="center">
      <div class="big-emoji">❤️</div>
      <h1 class="title">你是誰呢？</h1>
      <div style="height:16px"></div>
      ${Object.values(ROLES).map((r) => html`
        <button class="btn ${r.id}" onClick=${() => onSelect(r.id)}>我是${r.name}</button>
      `)}
    </div>
  `;
}
