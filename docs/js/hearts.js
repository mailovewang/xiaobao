// 愛心種類。推播文字在 worker/src/index.js 的 HEART_TEXT，兩邊 id 要一致
import { db, fs, notifyPartner } from './firebase.js';

export const HEARTS = [
  { id: 'miss', emoji: '❤️', label: '想你' },
  { id: 'morning', emoji: '☀️', label: '早安' },
  { id: 'night', emoji: '🌙', label: '晚安' },
  { id: 'hug', emoji: '🤗', label: '抱抱' },
  { id: 'arrived', emoji: '📍', label: '我到了' },
  { id: 'eat', emoji: '🍱', label: '吃飯了沒？' },
];
export const heartOf = (kind) => HEARTS.find((h) => h.id === kind) ?? HEARTS[0];

const pingsCol = () => fs.collection(db, 'spaces', 'home', 'pings');

/** 傳一顆愛心（kind 是上面的 id；kind='text' 時傳自己打的字）。 */
export async function sendHeart(from, kind, text = '') {
  const ref = await fs.addDoc(pingsCol(), {
    created_by: from,
    kind,
    ...(kind === 'text' ? { text: text.slice(0, 100) } : {}),
    created_at: fs.serverTimestamp(),
  });
  return notifyPartner('pings', ref.id);
}

/** 即時監聽今天的愛心（今天 0 點以後） */
export function observeTodayHearts(callback) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const q = fs.query(pingsCol(), fs.where('created_at', '>=', fs.Timestamp.fromDate(start)));
  return fs.onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.created_at?.seconds ?? Infinity) - (a.created_at?.seconds ?? Infinity)));
  });
}

/** 顯示用的文字 */
export const heartText = (p) => (p.kind === 'text' ? `💬 ${p.text}` : `${heartOf(p.kind).emoji} ${heartOf(p.kind).label}`);

/** 接住對方的愛心（對方會收到「接住了」的推播） */
export async function catchHeart(ping, me) {
  await fs.updateDoc(fs.doc(pingsCol(), ping.id), { caught_by: me, caught_at: fs.serverTimestamp() });
  notifyPartner('pings', ping.id, 'caught').catch(() => {});
}

/** 某段時間的所有愛心（每月回顧用） */
export async function heartsBetween(start, end) {
  const q = fs.query(pingsCol(),
    fs.where('created_at', '>=', fs.Timestamp.fromDate(start)),
    fs.where('created_at', '<', fs.Timestamp.fromDate(end)));
  return (await fs.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 最早的一顆愛心是哪個月（'YYYY-MM'），還沒有就回傳 null */
export async function firstHeartMonth() {
  const q = fs.query(pingsCol(), fs.orderBy('created_at'), fs.limit(1));
  const d = (await fs.getDocs(q)).docs[0]?.data().created_at?.toDate();
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
}
