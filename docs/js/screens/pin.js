import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { checkPin, hasPin, isUnlocked, setPin, unlock } from '../pin.js';
import { ROLES } from '../roles.js';

/** 4 位數字鍵盤。輸入滿 4 碼就呼叫 onComplete(code)，回傳錯誤訊息字串代表失敗。 */
function PinPad({ title, hint, onComplete }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function press(k) {
    if (busy) return;
    if (k === '⌫') return setCode((c) => c.slice(0, -1));
    const next = code + k;
    setCode(next);
    setError('');
    if (next.length < 4) return;
    setBusy(true);
    const err = await onComplete(next);
    setBusy(false);
    setCode('');
    if (err) setError(err);
  }

  return html`
    <div class="pin">
      <div class="big-emoji">🔒</div>
      <h2>${title}</h2>
      ${hint && html`<p class="hint">${hint}</p>`}
      <div class="pin-dots">${[0, 1, 2, 3].map((i) => html`<i class=${i < code.length ? 'on' : ''}></i>`)}</div>
      <p class="error" style="min-height:1.5em">${error}</p>
      <div class="pin-pad">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
          k ? html`<button type="button" onClick=${() => press(k)}>${k}</button>` : html`<span></span>`)}
      </div>
    </div>
  `;
}

/**
 * 上鎖的頁面：沒設過 PIN 就先設定，設過就要輸入，對了才顯示 children。
 * mode='change' 用來更改 PIN。
 * mode='verify' 用來確認「你真的是 me」（例如切換成這個身分）：沒設過 PIN 就直接通過，不會幫對方設 PIN。
 */
export function PinGate({ me, mode = 'unlock', onDone, children }) {
  const [step, setStep] = useState(isUnlocked(me) && mode !== 'change' ? 'pass' : 'loading');
  const [first, setFirst] = useState('');

  useEffect(() => {
    if (step === 'pass') { if (mode === 'verify') onDone?.(); else setStep('open'); return; }
    if (step !== 'loading') return;
    hasPin(me)
      .then((has) => {
        if (!has && mode === 'verify') return onDone?.();
        setStep(has ? 'enter' : 'new');
      })
      .catch(() => setStep('enter'));
  }, []);

  if (step === 'open') return children;
  if (step === 'loading' || step === 'pass') return html`<div class="center"><div class="spinner"></div></div>`;

  if (step === 'enter') {
    const name = ROLES[me].name;
    return html`<${PinPad}
      title=${mode === 'change' ? '請輸入目前的 PIN' : `${name}的 PIN`}
      hint=${mode === 'change' ? '' : mode === 'verify' ? `要用「${name}」的身分，請輸入${name}的 PIN` : '記帳和私密清單需要 PIN 才能打開'}
      onComplete=${async (code) => {
        if (!(await checkPin(me, code))) return 'PIN 不對 🙅';
        unlock(me);
        if (mode === 'change') setStep('new');
        else if (mode === 'verify') onDone?.();
        else { setStep('open'); onDone?.(); }
      }} />`;
  }
  if (step === 'new') {
    return html`<${PinPad}
      title=${mode === 'change' ? '請輸入新的 PIN' : '設定 4 位數 PIN'}
      hint="記帳和私密清單共用這組 PIN，對方不知道就打不開"
      onComplete=${async (code) => { setFirst(code); setStep('confirm'); }} />`;
  }
  // confirm
  return html`<${PinPad}
    title="再輸入一次確認"
    onComplete=${async (code) => {
      if (code !== first) { setStep('new'); return '兩次不一樣，請重新設定'; }
      await setPin(me, code);
      unlock(me);
      if (mode === 'change') onDone?.();
      else { setStep('open'); onDone?.(); }
    }} />`;
}
