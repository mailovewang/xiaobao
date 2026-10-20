// PIN 密碼鎖（記帳、私密清單共用）。
// 存在雲端 spaces/home/pins/{role}，只存加鹽雜湊，不存 PIN 本身。
// 放雲端是為了：就算對方在她手機「切換身分」成你，也要輸入你的 PIN。
// 注意：這是畫面鎖，不是加密，資料本身仍在共用資料庫裡。
import { db, fs } from './firebase.js';

const pinDoc = (role) => fs.doc(db, 'spaces', 'home', 'pins', role);

async function hash(pin, salt) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 這個身分設定過 PIN 了嗎？ */
export async function hasPin(role) {
  return (await fs.getDoc(pinDoc(role))).exists();
}

export async function setPin(role, pin) {
  const salt = crypto.getRandomValues(new Uint32Array(4)).join('-');
  await fs.setDoc(pinDoc(role), { salt, hash: await hash(pin, salt) });
}

export async function checkPin(role, pin) {
  const snap = await fs.getDoc(pinDoc(role));
  if (!snap.exists()) return false;
  const { salt, hash: expected } = snap.data();
  return (await hash(pin, salt)) === expected;
}

// 解鎖狀態只放在記憶體：App 切到背景、或換身分就重新上鎖
let unlockedRole = null;
export const isUnlocked = (role) => unlockedRole === role;
export const unlock = (role) => { unlockedRole = role; };
export const lock = () => { unlockedRole = null; };
document.addEventListener('visibilitychange', () => { if (document.hidden) lock(); });
