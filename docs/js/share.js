// 接收從 IG 等 App「分享 → 小寶」進來的文字。
// 需要 v1.1 以上的 APK（舊版外殼沒有這個功能，就什麼都不做）。
// 注意：外殼直接載入網頁、沒有打包 @capacitor/core，所以沒有 registerPlugin，
// 要跟推播一樣用 Capacitor.Plugins.XXX。
const C = window.Capacitor;
const plugin = C?.isNativePlatform?.() ? C.Plugins?.ShareTarget ?? null : null;

/** 有分享進來就呼叫 callback(text)。回傳取消監聽的函式。 */
export function onShared(callback) {
  if (!plugin?.take) return () => {};
  const take = () => Promise.resolve()
    .then(() => plugin.take())
    .then((r) => r?.text && callback(r.text))
    .catch(() => {});
  take(); // App 是被分享叫起來的
  let handle;
  try {
    handle = plugin.addListener('shared', take); // App 本來就開著
  } catch {
    // 監聽失敗就算了，至少開 App 時還會 take() 一次
  }
  return () => Promise.resolve(handle).then((h) => h?.remove?.()).catch(() => {});
}
