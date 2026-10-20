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

/** 是 Google 地圖的連結嗎？ */
export function isMapUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'maps.app.goo.gl' || u.hostname.startsWith('maps.google.')
      || (u.hostname.endsWith('google.com') && u.pathname.startsWith('/maps'))
      || (u.hostname === 'goo.gl' && u.pathname.startsWith('/maps'));
  } catch {
    return false;
  }
}

/**
 * 分享進來的文字 → 新增表單的預設值。
 * Google 地圖分享通常是「店名\n地址\nhttps://maps.app.goo.gl/...」，順便抓店名。
 */
export function parseShared(text) {
  const url = extractUrl(text);
  if (!url) return null;
  if (!isMapUrl(url)) return { ig_url: url };
  const before = text.slice(0, text.indexOf('http')).split('\n').map((s) => s.trim()).filter(Boolean)[0] ?? '';
  return { map_url: url, name: before.replace(/[,，]\s*$/, '') };
}

/** 導航用的地圖網址：有貼地圖連結就用它，沒有就用「店名 地區」搜尋 */
export function mapLinkOf(place) {
  const own = safeUrl(place.map_url || '');
  if (own) return own;
  const q = [place.name, place.area].filter(Boolean).join(' ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}
