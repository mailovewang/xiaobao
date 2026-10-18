// 本機定時提醒：每次行程資料變動，就把這支手機上排好的提醒全部重排一次。
// 只有在 APK 外殼裡才有作用。
import { addDays, nextOccurrence, parseDate, todayStr } from './dates.js';

const LN = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.LocalNotifications : null;

// 把字串變成固定的通知編號，同一個提醒每次重排編號都一樣
const idOf = (str) => {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2000000000 + 1;
};

/** 這支手機（me）應該收到哪些提醒。 */
export function plannedReminders(events, me, now = new Date()) {
  const list = [];
  const today = todayStr();

  for (const ev of events) {
    if (ev.type === 'event') {
      // 行程：只提醒本人，前一天（整天的行程在前一天晚上 8 點）
      if (ev.owner !== me || ev.date < today) continue;
      const at = ev.all_day || !ev.start_time
        ? parseDate(addDays(ev.date, -1), '20:00')
        : new Date(parseDate(ev.date, ev.start_time) - 86400000);
      const when = ev.all_day || !ev.start_time ? '明天' : `明天 ${ev.start_time}`;
      list.push({
        key: `${ev.id}:day-before`, at,
        title: `📅 ${when}：${ev.title}`,
        body: ev.location ? `📍 ${ev.location}` : '',
      });
    } else if (ev.type === 'anniversary') {
      // 紀念日：兩人都提醒，提前 14 天和當天早上 9 點
      const next = nextOccurrence(ev, today);
      if (!next) continue;
      const label = next.years > 0 ? `${ev.title}（${next.years} 週年）` : ev.title;
      list.push({
        key: `${ev.id}:${next.date}:-14`, at: parseDate(addDays(next.date, -14), '09:00'),
        title: `❤️ 再兩週就是${label}`, body: `${next.date.slice(5).replace('-', '/')}，記得準備喔`,
      });
      list.push({
        key: `${ev.id}:${next.date}:0`, at: parseDate(next.date, '09:00'),
        title: `❤️ 今天是${label}`, body: '',
      });
    }
  }
  return list.filter((r) => r.at > now);
}

let exactAllowed = null;

/** 是否允許「準時鬧鐘」；不允許的話提醒可能晚幾分鐘。瀏覽器回傳 null。 */
export async function checkExact() {
  if (!LN) return null;
  try {
    exactAllowed = (await LN.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    exactAllowed = true; // 舊版 Android 不需要這個權限
  }
  return exactAllowed;
}

export const askExact = () => LN?.changeExactNotificationSetting().then(checkExact);

/** 重排這支手機的所有提醒。 */
export async function syncReminders(events, me) {
  if (!LN) return;
  if (exactAllowed === null) await checkExact();
  await LN.createChannel({ id: 'reminders', name: '提醒', importance: 4 });

  const pending = (await LN.getPending()).notifications;
  if (pending.length) await LN.cancel({ notifications: pending.map((n) => ({ id: n.id })) });

  const list = plannedReminders(events, me).slice(0, 60);
  if (!list.length) return;
  await LN.schedule({
    notifications: list.map((r) => ({
      id: idOf(r.key),
      title: r.title,
      body: r.body,
      channelId: 'reminders',
      // 沒有準時權限時不要每次都跳設定畫面，改成一般鬧鐘
      isExactNotification: exactAllowed,
      schedule: { at: r.at, allowWhileIdle: true },
    })),
  });
}
