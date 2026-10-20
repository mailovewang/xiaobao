// 個人記帳：spaces/home/expenses，畫面只顯示自己的（owner === 我）
import { db, fs } from './firebase.js';

const col = () => fs.collection(db, 'spaces', 'home', 'expenses');

export const CATEGORIES = {
  expense: [
    { id: 'food', label: '餐飲', icon: '🍜' },
    { id: 'transport', label: '交通', icon: '🚌' },
    { id: 'fun', label: '娛樂', icon: '🎮' },
    { id: 'shopping', label: '購物', icon: '🛍️' },
    { id: 'other', label: '其他', icon: '📦' },
  ],
  income: [
    { id: 'allowance', label: '零用錢', icon: '💰' },
    { id: 'job', label: '打工', icon: '💼' },
    { id: 'other_income', label: '其他', icon: '📦' },
  ],
};
export const categoryOf = (kind, id) =>
  CATEGORIES[kind]?.find((c) => c.id === id) ?? { label: '其他', icon: '📦' };

/** 只監聽自己的帳 */
export function observeMyExpenses(me, callback) {
  return fs.onSnapshot(fs.query(col(), fs.where('owner', '==', me)), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export const addExpense = (data, me) => fs.addDoc(col(), { ...data, owner: me, created_at: fs.serverTimestamp() });
export const updateExpense = (id, data) => fs.updateDoc(fs.doc(col(), id), data);
export const deleteExpense = (id) => fs.deleteDoc(fs.doc(col(), id));

export const money = (n) => `$${Math.round(n).toLocaleString('zh-TW')}`;
