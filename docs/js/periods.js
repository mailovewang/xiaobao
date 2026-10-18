// 節次：每個人學校不同，各存一份在 spaces/home/periods/{role}，內容 { list: [{ label, start, end }] }
import { db, fs } from './firebase.js';

const periodsCol = () => fs.collection(db, 'spaces', 'home', 'periods');

// 還沒設定時先用這份（常見的大學節次），可以在課表的「⚙️ 節次」修改
export const DEFAULT_PERIODS = [
  ['第1節', '08:10', '09:00'], ['第2節', '09:10', '10:00'], ['第3節', '10:10', '11:00'],
  ['第4節', '11:10', '12:00'], ['第5節', '12:50', '13:40'], ['第6節', '13:50', '14:40'],
  ['第7節', '14:50', '15:40'], ['第8節', '15:50', '16:40'], ['第9節', '16:50', '17:40'],
].map(([label, start, end]) => ({ label, start, end }));

/** 即時監聽兩個人的節次：callback({ maimai: [...], xiaobao: [...] }) */
export function observePeriods(callback) {
  return fs.onSnapshot(periodsCol(), (snap) => {
    callback(Object.fromEntries(snap.docs.map((d) => [d.id, d.data().list ?? []])));
  });
}

export const savePeriods = (role, list) =>
  fs.setDoc(fs.doc(periodsCol(), role), { list: [...list].sort((a, b) => a.start.localeCompare(b.start)) });

/** 這門課佔了哪幾節（第一節 index、最後一節 index）；對不上任何一節回傳 null */
export function periodRange(periods, start, end) {
  const hit = periods.map((p, i) => (p.start < end && p.end > start ? i : -1)).filter((i) => i >= 0);
  return hit.length ? [hit[0], hit[hit.length - 1]] : null;
}
