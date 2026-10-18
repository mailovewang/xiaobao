// 日期小工具。日期一律用 'YYYY-MM-DD' 字串、手機本地時間（台灣）。

const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());

/** 'YYYY-MM-DD'（+ 'HH:mm'）→ Date */
export function parseDate(str, time = '00:00') {
  const [y, m, d] = str.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export const addDays = (str, n) => {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

/** b - a 相差幾天 */
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export const WEEKDAYS = WEEK;
export const prettyDate = (str) => {
  const d = parseDate(str);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
};

/** 這個行程／紀念日在 dateStr 這天出現嗎？（紀念日可每年重複） */
export function occursOn(ev, dateStr) {
  if (ev.date === dateStr) return true;
  return ev.type === 'anniversary' && ev.repeat_yearly
    && ev.date.slice(5) === dateStr.slice(5) && dateStr > ev.date;
}

/** 從 fromStr（含）開始，下一次出現的日期；不會再出現回傳 null。years = 第幾週年 */
export function nextOccurrence(ev, fromStr = todayStr()) {
  if (!(ev.type === 'anniversary' && ev.repeat_yearly)) {
    return ev.date >= fromStr ? { date: ev.date, years: 0 } : null;
  }
  const startYear = Number(ev.date.slice(0, 4));
  let year = Math.max(Number(fromStr.slice(0, 4)), startYear);
  let date = `${year}${ev.date.slice(4)}`;
  if (date < fromStr) date = `${++year}${ev.date.slice(4)}`;
  return { date, years: year - startYear };
}
