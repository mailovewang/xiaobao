// 備份：node scripts/backup.mjs
// 1. 把 Firestore 的 spaces/home（行程、課表、待辦、想去、記帳、私密…）匯出成 JSON
// 2. 連同 APK 簽章金鑰（~/.android/debug.keystore）和推播服務金鑰（.secrets/）
//    一起存到 backups/，有 OneDrive 的話再複製一份到 OneDrive/小寶app備份/
// 需要先 firebase login（用的是 Firebase CLI 的登入身分）。
import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'maimai-xiaobao-app';
const PRIVATE = ['secrets', 'expenses'];
const root = join(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const auth = require(join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));

const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('請先執行 firebase login');
const { access_token } = await auth.getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const call = async (url, body) => {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

// Firestore 的欄位格式 → 一般 JSON
const plain = (v) => {
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  if ('integerValue' in v) return Number(v.integerValue);
  return Object.values(v)[0];
};
const fieldsOf = (doc) => Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, v]) => [k, plain(v)]));

const home = await call(`${base}/spaces/home`).catch(() => ({}));
const data = { exported_at: new Date().toISOString(), settings: fieldsOf(home), collections: {} };
const { collectionIds = [] } = await call(`${base}/spaces/home:listCollectionIds`, { pageSize: 100 });
for (const col of collectionIds) {
  const docs = [];
  let pageToken = '';
  do {
    const page = await call(`${base}/spaces/home/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const d of page.documents ?? []) {
      const item = { id: d.name.split('/').pop(), ...fieldsOf(d) };
      if (col === 'devices') delete item.code; // 不把暗號寫進備份檔
      // 備份檔在麥麥的電腦上：不放小寶的私密清單和記帳（不然驚喜就破功了），也不放 PIN
      if (PRIVATE.includes(col) && item.owner !== 'maimai') continue;
      if (col === 'pins') continue;
      docs.push(item);
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  data.collections[col] = docs;
}

const stamp = new Date().toISOString().slice(0, 10);
const dir = join(root, 'backups', stamp);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'firestore.json'), JSON.stringify(data, null, 2));
const keystore = join(homedir(), '.android', 'debug.keystore');
if (existsSync(keystore)) copyFileSync(keystore, join(dir, 'debug.keystore'));
if (existsSync(join(root, '.secrets'))) cpSync(join(root, '.secrets'), join(dir, 'secrets'), { recursive: true });

const summary = Object.entries(data.collections).map(([k, v]) => `${k} ${v.length}`).join('、');
console.log(`已備份到 backups/${stamp}/：${summary}`);

const onedrive = join(homedir(), 'OneDrive');
if (existsSync(onedrive)) {
  const target = join(onedrive, '小寶app備份', stamp);
  cpSync(dir, target, { recursive: true });
  console.log(`也複製到 OneDrive：${target}`);
}
