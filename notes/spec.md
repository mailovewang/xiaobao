# 小寶 App 規格 v1（2026-10-18 確認）

使用者：麥麥（ROG Phone 9 Pro）、小寶（vivo V40），只做 Android，直接裝 APK 不上架。

## MVP 功能
0. 暗號與選身分：第一次開啟輸入兩人的暗號（存在 Firestore config/secret，App 讀不到），再選「我是麥麥／我是小寶」，「更多」裡可切換。
1. 日曆（含紀念日）：月曆，麥麥藍、小寶粉、紀念日 ❤️。行程屬於個人，前一天提醒本人；紀念日共同、可每年重複，提前 14 天與當天提醒兩人。
2. 課表：週課表，切換麥麥／小寶課表，只能改自己的。
3. 待辦：分頁「我要做的／我交代的／全部」，可指派給對方，指定時間提醒負責人。
4. 個人記帳：支出／收入、金額、分類（餐飲、交通、娛樂、購物、其他）、日期、備註，月合計。只有自己看得到。
5. 私密清單：驚喜／禮物／想法，只有自己看得到。
6. 通知：對方新增行程或待辦時即時推播；首頁有「傳愛心」按鈕。
7. 想去的地方（v1.1）：從 IG「分享 → 小寶」或貼上連結新增，記店名、地區、類型、誰想去，可依地區篩選，可標記去過。需要 v1.1 APK。

記帳與私密清單共用一組 4 位數 PIN（畫面鎖），App 切到背景就重新上鎖。

## 之後再做
交換日記、照片牆、上課提醒、桌面小工具、記帳預算圖表、共同記帳、離線快取。

## 技術架構（2026-10-18 改為網頁版，為了自動更新）
- App：網頁（Preact + htm，無建置步驟）放在 docs/，GitHub Pages 發布：https://mailovewang.github.io/xiaobao/
- 外殼：Capacitor 8 APK（android/），開啟時載入上面的網址，所以 push 到 GitHub 就等於更新 App
  - 已內建 local-notifications、push-notifications 外掛，做通知不必重裝 APK
- 資料：Firebase 專案 maimai-xiaobao-app（Spark 免費方案）：Firestore asia-east1、匿名登入
- 推播：Cloudflare Worker（免費、不綁卡）https://xiaobao-notify.maimai-xiaobao.workers.dev
  - App 新增資料後呼叫它 → 驗證登入與暗號 → 從資料庫讀內容 → 用 FCM 推給對方
  - 部署：worker\deploy.cmd（Firebase 服務帳戶金鑰在 .secrets\service-account.json，不上傳）
- 定時提醒：手機本機通知（local-notifications）
- 安全：網址公開，firestore.rules 只讓「輸入過正確暗號的匿名帳號」（spaces/home/devices/{uid}）讀寫
- 時區：一律 Asia/Taipei

### 已知取捨
- 暗號 4 碼偏短，理論上可被嘗試；要換暗號只要改 Firestore config/secret。
- 沒網路時 App 打不開。
- PIN 是畫面鎖，不是加密。
- vivo 省電可能延遲推播與鬧鐘，不做設定教學。
- APK 用這台電腦的 debug 簽章（~/.android/debug.keystore），換電腦要帶著它，否則無法覆蓋安裝。

## 資料結構（Firestore，皆在 spaces/home 底下）
| 集合 | 欄位 |
|---|---|
| devices/{uid} | code、joined_at（輸入過暗號的手機） |
| members/{role} | role（maimai／xiaobao）、uid、push_token、updated_at |
| pings | created_by、created_at（傳愛心） |
| events | type（event／anniversary）、owner（maimai／xiaobao／shared）、title、date（YYYY-MM-DD）、all_day、start_time、end_time（HH:mm）、location、note、repeat_yearly、created_by、created_at、updated_at |
| courses | owner、name、weekday（1=週一…7=週日）、start_time、end_time、location、color |
| periods/{role} | list：[{ label, start, end }]（每人學校的節次，課表一節一格） |
| todos | title、note、created_by、assignee、remind_at（YYYY-MM-DDTHH:mm）、done、done_by、done_at、created_at |
| expenses | owner、kind（expense／income）、amount、category、date、note、created_at |
| places | name、area、type（food／dessert／spot）、ig_url、wants（maimai／xiaobao／both）、note、visited、created_by、created_at（新增時推播對方） |
| secrets | owner、title、type（gift／surprise／idea）、note、target_date、done、created_at（不通知對方、不排提醒） |
| settings（spaces/home 本身） | relationship_start |
| pins/{role} | salt、hash（PIN 的加鹽 SHA-256；放雲端，對方切換成你的身分也要輸入你的 PIN） |
| 本機 | 目前身分 |

## 畫面
底部導覽：首頁、日曆、課表、待辦、更多
1. 暗號 2. 選擇身分 3. 首頁（交往第 N 天、下個紀念日倒數、今日行程、今日課、未完成待辦、傳愛心） 4. 日曆 5. 新增／編輯行程或紀念日 6. 課表 7. 新增／編輯課程 8. 待辦列表 9. 新增／編輯待辦 10. 更多 11. PIN 輸入 12. 記帳列表 13. 新增／編輯記帳 14. 私密清單 15. 設定（切換身分、交往起始日、PIN）

## 實作順序
0. 環境 ✅ → 1. 暗號與選身分 ✅ → 2. 推播 ✅ → 3. 日曆 ✅ → 4. 課表 ✅ → 5. 待辦 ✅ → 6. 記帳＋PIN ✅ → 7. 私密清單 ✅（MVP 完成 v1.0）
