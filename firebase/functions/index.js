// 有人新增東西時，推播給另一個人。
// 只負責「讀對方的推播位址 → 發推播」，絕不回寫資料（避免無限觸發）。
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const NAMES = { maimai: '麥麥', xiaobao: '小寶' };
const partnerOf = (id) => (id === 'maimai' ? 'xiaobao' : 'maimai');

// 每種資料要推播什麼內容；沒列在這裡的（members、devices）不推播
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
    default:
      return null;
  }
}

exports.notifyPartner = onDocumentCreated(
  { document: 'spaces/home/{collection}/{id}', region: 'asia-east1' },
  async (event) => {
    const data = event.data?.data();
    const from = data?.created_by;
    if (!NAMES[from]) return;

    const message = buildMessage(event.params.collection, data, NAMES[from]);
    if (!message) return;

    const member = await getFirestore().doc(`spaces/home/members/${partnerOf(from)}`).get();
    const token = member.get('push_token');
    if (!token) return;

    try {
      await getMessaging().send({
        token,
        notification: message,
        android: { priority: 'high', notification: { channelId: 'partner' } },
        data: { collection: event.params.collection },
      });
    } catch (e) {
      // 對方手機的推播位址失效（例如重裝 App），記錄下來就好，等對方打開 App 會自動更新
      console.warn('send failed', e.code, e.message);
    }
  },
);
