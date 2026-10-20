// 推播：只有在 APK 外殼裡才有，用瀏覽器開的話會略過
import { savePushToken } from './firebase.js';

const native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;

/**
 * 開啟推播並把這支手機的推播位址（token）存到自己的身分底下。
 * 回傳 'ok' | 'denied' | 'web'。
 */
export async function setupPush(roleId) {
  const push = native?.PushNotifications;
  if (!push) return 'web';

  let perm = await push.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await push.requestPermissions();
  }
  if (perm.receive !== 'granted') return 'denied';

  await push.createChannel({ id: 'partner', name: '對方的動態', importance: 4 });
  await push.removeAllListeners();
  push.addListener('registration', (t) => savePushToken(roleId, t.value));
  // App 開著的時候系統不會自己跳通知，改用本機通知顯示
  push.addListener('pushNotificationReceived', (n) => {
    native.LocalNotifications?.schedule({
      notifications: [{ id: Date.now() % 2147483647, title: n.title, body: n.body, channelId: 'partner' }],
    });
  });
  await push.register();
  return 'ok';
}
