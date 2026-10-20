import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { CATEGORIES, addExpense, categoryOf, deleteExpense, money, observeMyExpenses, updateExpense } from '../ledger.js';
import { prettyDate, toDateStr, todayStr } from '../dates.js';

export function LedgerScreen({ me }) {
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [editing, setEditing] = useState(null);
  useEffect(() => observeMyExpenses(me, setItems), [me]);

  const [y, m] = month.split('-').map(Number);
  const shift = (n) => setMonth(toDateStr(new Date(y, m - 1 + n, 1)).slice(0, 7));

  const list = items.filter((x) => x.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0));
  const sum = (kind) => list.filter((x) => x.kind === kind).reduce((s, x) => s + x.amount, 0);
  const spent = sum('expense');
  const earned = sum('income');
  const byCat = CATEGORIES.expense
    .map((c) => ({ ...c, total: list.filter((x) => x.kind === 'expense' && x.category === c.id).reduce((s, x) => s + x.amount, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const days = [...new Set(list.map((x) => x.date))];

  return html`
    <div class="page">
      <div class="month-bar">
        <button class="icon-btn" onClick=${() => shift(-1)}>‹</button>
        <h1>${y} 年 ${m} 月</h1>
        <button class="icon-btn" onClick=${() => shift(1)}>›</button>
      </div>

      <div class="ledger-sum">
        <div><small>支出</small><b class="out">${money(spent)}</b></div>
        <div><small>收入</small><b class="in">${money(earned)}</b></div>
        <div><small>結餘</small><b>${money(earned - spent)}</b></div>
      </div>

      ${byCat.length > 0 && html`
        <div class="card">
          ${byCat.map((c) => html`
            <div class="cat-row">
              <span>${c.icon} ${c.label}</span>
              <div class="cat-bar"><i style=${`width:${(c.total / spent) * 100}%`}></i></div>
              <span class="cat-amt">${money(c.total)}</span>
            </div>`)}
        </div>`}

      ${list.length === 0 && html`<p class="hint" style="text-align:center">這個月還沒有記帳，按 ＋ 記一筆</p>`}
      ${days.map((d) => html`
        <h2 class="day-title">${prettyDate(d)}</h2>
        <div class="list">
          ${list.filter((x) => x.date === d).map((x) => {
            const c = categoryOf(x.kind, x.category);
            return html`
              <button class="list-item ledger-item" onClick=${() => setEditing(x)}>
                <span>${c.icon} ${x.note || c.label}${x.note ? html`<small>${c.label}</small>` : ''}</span>
                <b class=${x.kind === 'expense' ? 'out' : 'in'}>${x.kind === 'expense' ? '-' : '+'}${money(x.amount)}</b>
              </button>`;
          })}
        </div>
      `)}

      <button class="fab" onClick=${() => setEditing({})}>＋</button>
      ${editing && html`<${ExpenseForm} me=${me} item=${editing} onClose=${() => setEditing(null)} />`}
    </div>
  `;
}

function ExpenseForm({ me, item, onClose }) {
  const isNew = !item.id;
  const [f, setF] = useState({
    kind: item.kind ?? 'expense',
    amount: item.amount ? String(item.amount) : '',
    category: item.category ?? 'food',
    date: item.date ?? todayStr(),
    note: item.note ?? '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };
  const setKind = (kind) => setF((p) => ({ ...p, kind, category: CATEGORIES[kind][0].id }));

  function save(e) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!(amount > 0)) return setError('請輸入金額');
    const data = { ...f, amount: Math.round(amount), note: f.note.trim() };
    (isNew ? addExpense(data, me) : updateExpense(item.id, data)).catch(() => {});
    onClose();
  }

  function remove() {
    if (!confirm('要刪除這筆嗎？')) return;
    deleteExpense(item.id).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '記一筆' : '編輯'}</h2>
        <div class="segmented">
          <button type="button" class=${f.kind === 'expense' ? 'on' : ''} onClick=${() => setKind('expense')}>支出</button>
          <button type="button" class=${f.kind === 'income' ? 'on' : ''} onClick=${() => setKind('income')}>收入</button>
        </div>
        <label>金額<input class="amount-input" type="number" inputmode="numeric" min="1" value=${f.amount} onInput=${set('amount')} placeholder="0" /></label>
        <div>
          <div class="field-label">分類</div>
          <div class="chips wrap">
            ${CATEGORIES[f.kind].map((c) => html`
              <button type="button" class=${f.category === c.id ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, category: c.id }))}>${c.icon} ${c.label}</button>
            `)}
          </div>
        </div>
        <label>日期<input type="date" value=${f.date} onInput=${set('date')} required /></label>
        <label>備註<input value=${f.note} onInput=${set('note')} placeholder="例如：午餐便當" /></label>
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
