// 行程與紀念日：spaces/home/events，以及交往起始日（spaces/home 本身的 relationship_start）
import { db, fs, notifyPartner } from './firebase.js';
import { addDays, daysBetween, todayStr } from './dates.js';

const eventsCol = () => fs.collection(db, 'spaces', 'home', 'events');
const homeDoc = () => fs.doc(db, 'spaces', 'home');

/** 即時監聽所有行程與紀念日。 */
export function observeEvents(callback) {
  return fs.onSnapshot(eventsCol(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/** 新增後通知對方（通知失敗不影響資料）。 */
export async function addEvent(data, me) {
  const ref = await fs.addDoc(eventsCol(), {
    ...data,
    created_by: me,
    created_at: fs.serverTimestamp(),
    updated_at: fs.serverTimestamp(),
  });
  notifyPartner('events', ref.id).catch(() => {});
}

export const updateEvent = (id, data) =>
  fs.updateDoc(fs.doc(eventsCol(), id), { ...data, updated_at: fs.serverTimestamp() });

export const deleteEvent = (id) => fs.deleteDoc(fs.doc(eventsCol(), id));

/** 共用設定（目前只有交往起始日）。 */
export function observeSettings(callback) {
  return fs.onSnapshot(homeDoc(), (snap) => callback(snap.data() ?? {}));
}

export const saveRelationshipStart = (date) =>
  fs.setDoc(homeDoc(), { relationship_start: date }, { merge: true });

/**
 * 交往起始日自動產生的紀念日（日曆、首頁倒數、提醒都會用到；不能直接編輯，要到「更多」改起始日）：
 * - 每年的「交往紀念日（N 週年）」
 * - 每 100 天的里程碑「交往第 N 天」（算到大約 3 年後）
 */
export function withRelationship(events, settings) {
  const start = settings.relationship_start;
  if (!start) return events;
  const auto = (id, title, date, repeat) =>
    ({ id, type: 'anniversary', owner: 'shared', title, date, repeat_yearly: repeat, virtual: true });

  const milestones = [];
  const daysSoFar = daysBetween(start, todayStr()) + 1; // 今天是第幾天
  for (let n = 100; n <= daysSoFar + 1100; n += 100) {
    milestones.push(auto(`day-${n}`, `交往第 ${n} 天`, addDays(start, n - 1), false));
  }
  return [...events, auto('relationship', '交往紀念日', start, true), ...milestones];
}
