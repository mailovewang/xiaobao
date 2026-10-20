// 所有雲端讀寫都從這裡進出。資料都放在 Firestore 的 spaces/home 底下。
const V = '10.12.2';
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const { getAuth, signInAnonymously, onAuthStateChanged } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

// 這組設定本來就是公開的，安全性靠 firestore.rules 和暗號
const app = initializeApp({
  apiKey: 'AIzaSyD5ePLPgYVMu3xFc6DfHw21wCP3aBe-BEA',
  authDomain: 'maimai-xiaobao-app.firebaseapp.com',
  projectId: 'maimai-xiaobao-app',
  storageBucket: 'maimai-xiaobao-app.firebasestorage.app',
  messagingSenderId: '1188882177',
  appId: '1:1188882177:web:f6ce7f3d076d231b7d5d00',
});

const auth = getAuth(app);
// 開啟離線快取：沒網路時也看得到上次的資料
export const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
export { fs };

const deviceDoc = () => fs.doc(db, 'spaces', 'home', 'devices', auth.currentUser.uid);

/** 背景匿名登入，回傳使用者。 */
export function signIn() {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (user) => {
      if (user) { off(); resolve(user); }
      else signInAnonymously(auth).catch((e) => { off(); reject(e); });
    });
  });
}

/** 這支手機輸入過暗號了嗎？ */
export async function isJoined() {
  const snap = await fs.getDoc(deviceDoc());
  return snap.exists();
}

/** 用暗號加入。暗號錯了 Firestore 會拒絕，回傳 false。 */
export async function join(code) {
  try {
    await fs.setDoc(deviceDoc(), { code, joined_at: fs.serverTimestamp() });
    return true;
  } catch (e) {
    if (e.code === 'permission-denied') return false;
    throw e;
  }
}

/**
 * 告訴對方「我在這支手機上用這個身分」。
 * 身分也記在這支手機自己的 devices/{uid}，推播服務靠它找到「對方的手機」。
 */
export function registerMember(roleId) {
  return Promise.all([
    fs.setDoc(fs.doc(db, 'spaces', 'home', 'members', roleId), {
      role: roleId,
      updated_at: fs.serverTimestamp(),
    }, { merge: true }),
    fs.setDoc(deviceDoc(), { role: roleId, seen_at: fs.serverTimestamp() }, { merge: true }),
  ]);
}

/**
 * 存這支手機的推播位址（每支手機各存一份在 devices/{uid}）。
 * 以前存在 members/{role}，手機在切換身分時會把對方的位址清掉，所以改掉了。
 */
export function savePushToken(roleId, token) {
  return fs.setDoc(deviceDoc(), { role: roleId, push_token: token }, { merge: true });
}

// 推播服務（Cloudflare Worker）。本機測試時用 wrangler dev 的位址
const NOTIFY_URL = location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : 'https://xiaobao-notify.maimai-xiaobao.workers.dev';

/** 請推播服務通知對方「我新增了（或完成了 action='done'）collection/id」。失敗不影響資料本身。 */
export async function notifyPartner(collection, id, action = 'created') {
  const res = await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection, id, action }),
  });
  return res.json();
}

/** 即時監聽誰已經加入。回傳取消監聽的函式。 */
export function observeMembers(callback) {
  return fs.onSnapshot(fs.collection(db, 'spaces', 'home', 'members'), (snap) => {
    callback(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])));
  });
}
