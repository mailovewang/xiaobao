// 私密清單：spaces/home/secrets，只顯示自己的，不會通知對方，也不排提醒（免得鎖定畫面被看到）
import { db, fs } from './firebase.js';

const col = () => fs.collection(db, 'spaces', 'home', 'secrets');

export const SECRET_TYPES = [
  { id: 'gift', label: '禮物', icon: '🎁' },
  { id: 'surprise', label: '驚喜', icon: '🎉' },
  { id: 'idea', label: '想法', icon: '💡' },
];
export const typeOf = (id) => SECRET_TYPES.find((t) => t.id === id) ?? SECRET_TYPES[2];

export function observeMySecrets(me, callback) {
  return fs.onSnapshot(fs.query(col(), fs.where('owner', '==', me)), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export const addSecret = (data, me) =>
  fs.addDoc(col(), { ...data, owner: me, done: false, created_at: fs.serverTimestamp() });
export const updateSecret = (id, data) => fs.updateDoc(fs.doc(col(), id), data);
export const deleteSecret = (id) => fs.deleteDoc(fs.doc(col(), id));
