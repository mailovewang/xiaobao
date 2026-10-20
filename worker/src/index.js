// 小寶推播服務（Cloudflare Worker，免費方案）
// App 新增資料後呼叫這裡 → 確認是自己人 → 讀那筆資料 → 推播給另一個人。
// 推播內容一律從資料庫讀，不相信 App 傳來的文字。

const NAMES = { maimai: '麥麥', xiaobao: '小寶' };
const partnerOf = (id) => (id === 'maimai' ? 'xiaobao' : 'maimai');
const COLLECTIONS = ['pings', 'events', 'todos', 'places'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};
const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return reply(405, { error: 'method' });

    try {
      const { collection, id, action = 'created' } = await request.json().catch(() => ({}));
      if (!COLLECTIONS.includes(collection) || !/^[A-Za-z0-9]{1,64}$/.test(id ?? '')) {
        return reply(400, { error: 'bad request' });
      }

      const sa = JSON.parse(env.SERVICE_ACCOUNT);
      const uid = await verifyIdToken(request.headers.get('Authorization')?.replace(/^Bearer /, ''), sa.project_id);
      if (!uid) return reply(401, { error: 'unauthorized' });

      const google = await googleToken(sa);
      const db = (path) => firestoreGet(sa.project_id, google, `spaces/home/${path}`);

      // 只有輸入過暗號的手機可以要求推播
      if (!(await db(`devices/${uid}`))) return reply(403, { error: 'not joined' });

      const doc = await db(`${collection}/${id}`);
      // 「完成待辦」由完成的人發出，其他都由新增的人發出
      const done = action === 'done' && collection === 'todos';
      const from = done ? doc?.done_by : doc?.created_by;
      if (!NAMES[from] || (done && !doc.done)) return reply(404, { error: 'no such doc' });

      const message = done
        ? { title: `${NAMES[from]} 完成了你交代的事 ✅`, body: doc.title || '' }
        : buildMessage(collection, doc, NAMES[from]);
      // 對方的所有手機（每支手機在 devices/{uid} 記著自己的身分和推播位址）
      const partnerRole = partnerOf(from);
      const devices = await firestoreQuery(sa.project_id, google, 'devices', 'role', partnerRole);
      const legacy = await db(`members/${partnerRole}`); // 舊版存在這裡，相容一下
      const tokens = [...new Set([...devices.map((d) => d.push_token), legacy?.push_token].filter(Boolean))];
      if (!tokens.length) return reply(200, { sent: false, reason: 'partner has no push token' });

      let sent = 0;
      for (const token of tokens) {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${google}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: message,
              android: { priority: 'high', notification: { channel_id: 'partner' } },
              data: { collection },
            },
          }),
        });
        if (res.ok) sent++;
      }
      return reply(200, { sent: sent > 0, devices: tokens.length, delivered: sent });
    } catch (e) {
      return reply(500, { error: e.message });
    }
  },
};

function buildMessage(collection, data, name) {
  switch (collection) {
    case 'pings':
      return { title: `${name} 想你了 💕`, body: '傳了一顆愛心給你' };
    case 'events':
      return data.type === 'anniversary'
        ? { title: `${name} 新增了紀念日 ❤️`, body: data.title || '' }
        : { title: `${name} 新增了行程 📅`, body: data.title || '' };
    case 'todos':
      return data.assignee && data.assignee !== data.created_by
        ? { title: `${name} 交代你一件事 ✅`, body: data.title || '' }
        : { title: `${name} 新增了待辦`, body: data.title || '' };
    case 'places':
      return { title: `${name} 找到想去的地方 📍`, body: [data.name, data.area].filter(Boolean).join(' · ') };
  }
}

// ---------- Firestore（用管理員權限讀，回傳簡單物件；不存在回傳 null） ----------
async function firestoreGet(projectId, token, path) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore ${res.status}`);
  const { fields = {} } = await res.json();
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.stringValue ?? v.booleanValue ?? v.integerValue ?? v.timestampValue ?? null]),
  );
}

/** 查 spaces/home/{collection} 裡 field == value 的文件 */
async function firestoreQuery(projectId, token, collection, field, value) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/spaces/home:runQuery`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`firestore query ${res.status}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => Object.fromEntries(
    Object.entries(r.document.fields ?? {}).map(([k, v]) => [k, v.stringValue ?? v.booleanValue ?? null]),
  ));
}

// ---------- 驗證 App 傳來的 Firebase 登入憑證 ----------
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const decode = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

async function verifyIdToken(jwt, projectId) {
  try {
    return await verifyIdTokenUnsafe(jwt, projectId);
  } catch {
    return null; // 格式亂掉的憑證一律當作沒登入
  }
}

async function verifyIdTokenUnsafe(jwt, projectId) {
  if (!jwt) return null;
  const [h, p, s] = jwt.split('.');
  const header = decode(h);
  const payload = decode(p);
  const now = Date.now() / 1000;
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (payload.exp < now || payload.iat > now + 60 || !payload.sub) return null;

  const jwks = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', {
    cf: { cacheTtl: 3600 },
  }).then((r) => r.json());
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  return ok ? payload.sub : null;
}

// ---------- 用服務帳戶換 Google 存取權杖 ----------
const toB64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jsonB64url = (obj) => toB64url(new TextEncoder().encode(JSON.stringify(obj)));

async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${jsonB64url({ alg: 'RS256', typ: 'JWT' })}.${jsonB64url({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${toB64url(sig)}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('google token failed');
  return json.access_token;
}
