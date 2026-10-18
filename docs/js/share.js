// 接收從 IG 等 App「分享 → 小寶」進來的文字。
// 需要 v1.1 以上的 APK（舊版外殼沒有這個功能，就什麼都不做）。
const C = window.Capacitor;
const plugin = C?.isNativePlatform?.() && C.isPluginAvailable?.('ShareTarget') ? C.registerPlugin('ShareTarget') : null;

/** 有分享進來就呼叫 callback(text)。回傳取消監聽的函式。 */
export function onShared(callback) {
  if (!plugin) return () => {};
  const take = () => plugin.take().then((r) => r.text && callback(r.text)).catch(() => {});
  take(); // App 是被分享叫起來的
  const handle = plugin.addListener('shared', take); // App 本來就開著
  return () => Promise.resolve(handle).then((h) => h.remove());
}
