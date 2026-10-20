// 「這個月的我們」：從已經存下來的愛心自動整理，不用輸入任何東西。
// 只算兩個人加起來的數字，不比誰傳得多。
import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { heartOf, heartsBetween } from '../hearts.js';
import { toDateStr } from '../dates.js';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number);
  return [new Date(y, m - 1, 1), new Date(y, m, 1)];
};
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthLabel = (key) => `${Number(key.slice(5))} 月`;

/** 統計一個月的愛心 */
export function summarize(pings) {
  const list = pings.filter((p) => p.created_at?.toDate).map((p) => ({ ...p, at: p.created_at.toDate() }))
    .sort((a, b) => a.at - b.at);
  if (!list.length) return null;

  const counts = {};
  for (const p of list) if (p.kind !== 'text') counts[p.kind ?? 'miss'] = (counts[p.kind ?? 'miss'] || 0) + 1;
  const [topKind, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];

  // 深夜 0–4 點算成「前一天很晚」，才能比出最晚的晚安
  const lateness = (d) => (d.getHours() < 5 ? d.getHours() + 24 : d.getHours()) * 60 + d.getMinutes();
  const nights = list.filter((p) => p.kind === 'night');
  const latestNight = nights.sort((a, b) => lateness(b.at) - lateness(a.at))[0];
  const mornings = list.filter((p) => p.kind === 'morning');
  const earliestMorning = mornings.sort((a, b) => (a.at.getHours() * 60 + a.at.getMinutes()) - (b.at.getHours() * 60 + b.at.getMinutes()))[0];

  const days = [...new Set(list.map((p) => toDateStr(p.at)))].sort();
  let streak = 1;
  let best = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = (new Date(days[i]) - new Date(days[i - 1])) / 86400000;
    streak = gap === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
  }

  return {
    total: list.length,
    caught: list.filter((p) => p.caught_by).length,
    texts: list.filter((p) => p.kind === 'text').length,
    top: topKind && { ...heartOf(topKind), count: topCount },
    latestNight: latestNight && hhmm(latestNight.at),
    earliestMorning: earliestMorning && hhmm(earliestMorning.at),
    days: days.length,
    streak: best,
    first: list[0],
  };
}

/** 一個月的回顧卡 */
export function MonthCard({ month, title, onClose }) {
  const [s, setS] = useState(undefined); // undefined = 載入中, null = 沒資料
  useEffect(() => {
    const [start, end] = monthRange(month);
    heartsBetween(start, end).then((list) => setS(summarize(list))).catch(() => setS(null));
  }, [month]);

  return html`
    <div class="card month-card">
      <div class="month-head">
        <b>${title ?? `📊 ${monthLabel(month)}的我們`}</b>
        ${onClose && html`<button class="icon-btn small" onClick=${onClose} aria-label="關閉">✕</button>`}
      </div>
      ${s === undefined && html`<p class="hint">整理中…</p>`}
      ${s === null && html`<p class="hint">這個月還沒有愛心紀錄</p>`}
      ${s && html`
        <div class="month-big">💕 一起傳了 <b>${s.total}</b> 顆愛心</div>
        <ul class="month-list">
          <li>📅 有 ${s.days} 天互相傳愛心${s.streak > 1 ? `，最長連續 ${s.streak} 天` : ''}</li>
          ${s.top && html`<li>${s.top.emoji} 最常說的是「${s.top.label}」（${s.top.count} 次）</li>`}
          ${s.caught > 0 && html`<li>🤲 有 ${s.caught} 顆愛心被接住</li>`}
          ${s.texts > 0 && html`<li>💬 說了 ${s.texts} 句悄悄話</li>`}
          ${s.earliestMorning && html`<li>☀️ 最早的早安：${s.earliestMorning}</li>`}
          ${s.latestNight && html`<li>🌙 最晚的晚安：${s.latestNight}</li>`}
          <li>✨ 這個月的第一顆：${s.first.at.getMonth() + 1}/${s.first.at.getDate()} ${hhmm(s.first.at)}「${s.first.kind === 'text' ? s.first.text : heartOf(s.first.kind).label}」</li>
        </ul>`}
    </div>
  `;
}

/** 首頁用：每月 1～7 號顯示上個月的回顧，按 ✕ 就不再出現（只記在這支手機） */
export function useMonthlyCard() {
  const now = new Date();
  const prev = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const read = () => { try { return localStorage.getItem('monthly-dismissed'); } catch { return null; } };
  const [dismissed, setDismissed] = useState(read());
  const show = now.getDate() <= 7 && dismissed !== prev;
  const dismiss = () => {
    try { localStorage.setItem('monthly-dismissed', prev); } catch {}
    setDismissed(prev);
  };
  return [show ? prev : null, dismiss];
}

