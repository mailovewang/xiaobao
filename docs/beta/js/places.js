// 想去的地方：spaces/home/places，兩人共用。新增時推播給對方。
import { db, fs, notifyPartner } from './firebase.js';

const col = () => fs.collection(db, 'spaces', 'home', 'places');

export const PLACE_TYPES = [
  { id: 'food', label: '餐廳', icon: '🍽️' },
  { id: 'dessert', label: '甜點飲料', icon: '🧋' },
  { id: 'spot', label: '景點', icon: '🏞️' },
];
export const placeTypeOf = (id) => PLACE_TYPES.find((t) => t.id === id) ?? PLACE_TYPES[0];

export function observePlaces(callback) {
  return fs.onSnapshot(col(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addPlace(data, me) {
  const ref = await fs.addDoc(col(), { ...data, created_by: me, created_at: fs.serverTimestamp() });
  notifyPartner('places', ref.id).catch(() => {});
}
export const updatePlace = (id, data) => fs.updateDoc(fs.doc(col(), id), data);
export const deletePlace = (id) => fs.deleteDoc(fs.doc(col(), id));

/** 只接受 http(s) 網址，其他（例如 javascript:）一律當作沒有，避免點連結時執行奇怪的程式 */
export function safeUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '';
  } catch {
    return '';
  }
}

/** 從分享或貼上的文字裡找出網址（IG 分享常是「看看這個 https://www.instagram.com/reel/...」） */
export function extractUrl(text) {
  const m = (text || '').match(/https?:\/\/[^\s]+/);
  return m ? safeUrl(m[0]) : '';
}
