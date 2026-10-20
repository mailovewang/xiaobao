// 行程與紀念日：spaces/home/events，以及交往起始日（spaces/home 本身的 relationship_start）
import { db, fs, notifyPartner } from './firebase.js';

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

/** 交往起始日變成一個「每年重複的紀念日」，日曆和提醒都會用到；不能直接編輯，要到「更多」改。 */
export function withRelationship(events, settings) {
  if (!settings.relationship_start) return events;
  return [
    ...events,
    {
      id: 'relationship',
      type: 'anniversary',
      owner: 'shared',
      title: '交往紀念日',
      date: settings.relationship_start,
      repeat_yearly: true,
      virtual: true,
    },
  ];
}
