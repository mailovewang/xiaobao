// 課表：spaces/home/courses，每堂課屬於一個人（owner），只有本人能改
import { db, fs } from './firebase.js';

const coursesCol = () => fs.collection(db, 'spaces', 'home', 'courses');

// 星期：1 = 週一 … 7 = 週日
export const WEEKDAY_NAMES = ['', '一', '二', '三', '四', '五', '六', '日'];
export const COURSE_COLORS = ['#f48fb1', '#90caf9', '#a5d6a7', '#ffcc80', '#ce93d8', '#80cbc4', '#fff176', '#bcaaa4'];

/** 今天是星期幾（1–7） */
export const todayWeekday = () => new Date().getDay() || 7;

export function observeCourses(callback) {
  return fs.onSnapshot(coursesCol(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export const addCourse = (data, me) =>
  fs.addDoc(coursesCol(), { ...data, owner: me, created_at: fs.serverTimestamp() });

export const updateCourse = (id, data) => fs.updateDoc(fs.doc(coursesCol(), id), data);

export const deleteCourse = (id) => fs.deleteDoc(fs.doc(coursesCol(), id));

/** 某人某天的課，依時間排序 */
export const coursesOn = (courses, owner, weekday) =>
  courses
    .filter((c) => c.owner === owner && c.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
