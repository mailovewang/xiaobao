// 待辦：spaces/home/todos。可以指派給自己或對方，時間到提醒負責的人。
import { db, fs, notifyPartner } from './firebase.js';

const todosCol = () => fs.collection(db, 'spaces', 'home', 'todos');

export function observeTodos(callback) {
  return fs.onSnapshot(todosCol(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/** 新增後通知對方（例如「麥麥交代你一件事」）。 */
export async function addTodo(data, me) {
  const ref = await fs.addDoc(todosCol(), {
    ...data,
    created_by: me,
    done: false,
    created_at: fs.serverTimestamp(),
  });
  notifyPartner('todos', ref.id).catch(() => {});
}

export const updateTodo = (id, data) => fs.updateDoc(fs.doc(todosCol(), id), data);

export const deleteTodo = (id) => fs.deleteDoc(fs.doc(todosCol(), id));

/** 打勾／取消打勾。完成對方交代的事時，通知對方。 */
export async function setDone(todo, done, me) {
  await updateTodo(todo.id, { done, done_by: done ? me : null, done_at: done ? fs.serverTimestamp() : null });
  if (done && todo.created_by !== me) notifyPartner('todos', todo.id, 'done').catch(() => {});
}

/** 排序：有提醒時間的照時間，沒有的放後面，再照建立順序 */
export const sortTodos = (list) =>
  [...list].sort((a, b) =>
    (a.remind_at || '9999').localeCompare(b.remind_at || '9999')
    || (a.created_at?.seconds ?? 0) - (b.created_at?.seconds ?? 0));
