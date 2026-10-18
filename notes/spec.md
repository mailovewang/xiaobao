# 小寶 App 規格 v1（2026-10-18 確認）

使用者：麥麥（ROG Phone 9 Pro）、小寶（vivo V40），只做 Android，直接裝 APK 不上架。

## MVP 功能
0. 選身分：第一次開啟選「我是麥麥／我是小寶」，設定裡可切換。不用登入、不用配對碼、不用密碼。
1. 日曆（含紀念日）：月曆，麥麥藍、小寶粉、紀念日 ❤️。行程屬於個人，前一天提醒本人；紀念日共同、可每年重複，提前 14 天與當天提醒兩人。
2. 課表：週課表，切換麥麥／小寶課表，只能改自己的。
3. 待辦：分頁「我要做的／我交代的／全部」，可指派給對方，指定時間提醒負責人。
4. 個人記帳：支出／收入、金額、分類（餐飲、交通、娛樂、購物、其他）、日期、備註，月合計。只有自己看得到。
5. 私密清單：驚喜／禮物／想法，只有自己看得到。
6. 通知：對方新增行程或待辦時即時推播。

記帳與私密清單共用一組 4 位數 PIN（畫面鎖）。

## 之後再做
想去的地方清單、交換日記、照片牆、上課提醒、桌面小工具、「想你」按鈕、記帳預算圖表、共同記帳。

## 技術架構（llm-council 決議）
- App：Kotlin + Jetpack Compose（Material 3）
- 後端：Firebase 專用專案，掛在既有 Blaze 帳單帳戶，設 1 美元預算警示
  - Firestore（即時同步、離線可用）
  - Authentication：匿名登入（背景自動）
  - Cloud Messaging + 一個 Cloud Function：events / todos 新增時推播給對方（data message，順便讓對方手機排鬧鐘）。Function 只發推播，絕不回寫資料庫。
- 本機提醒：AlarmManager 精準鬧鐘，開機後重排
- 時區：一律 Asia/Taipei
- 整個資料庫只有一個空間（spaces/home），不需配對碼

### 已知取捨
- 沒有配對碼與密碼：安全性仰賴 APK 只裝在兩人手機上。
- PIN 是畫面鎖，不是加密；技術上對方仍可能讀到。兩人已接受。
- vivo 省電可能延遲推播與鬧鐘，不做設定教學。
- 簽章金鑰（keystore）要另外備份，遺失就無法更新 App。

## 資料結構（Firestore，皆在 spaces/home 底下）
| 集合 | 欄位 |
|---|---|
| members/{role} | role（maimai／xiaobao）、push_token、updated_at |
| events | type（event／anniversary）、owner（maimai／xiaobao／shared）、title、start_at、end_at、all_day、location、note、repeat_yearly、created_by、created_at、updated_at |
| courses | owner、name、weekday、start_time、end_time、location、color |
| todos | title、note、created_by、assignee、remind_at、done、done_at、created_at |
| expenses | owner、kind（expense／income）、amount、category、date、note、created_at |
| secrets | owner、title、type、note、target_date、done |
| settings（spaces/home 本身） | relationship_start |
| 本機 | 目前身分、PIN 雜湊值 |

## 畫面
底部導覽：首頁、日曆、課表、待辦、更多
1. 選擇身分 2. 首頁（交往第 N 天、下個紀念日倒數、今日行程、今日課、未完成待辦） 3. 日曆 4. 新增／編輯行程或紀念日 5. 課表 6. 新增／編輯課程 7. 待辦列表 8. 新增／編輯待辦 9. 更多 10. PIN 輸入 11. 記帳列表 12. 新增／編輯記帳 13. 私密清單 14. 設定（切換身分、交往起始日、PIN）

## 實作順序
0. 環境與空白 App → 1. 選身分 → 2. 推播打通 → 3. 日曆 → 4. 課表 → 5. 待辦 → 6. 記帳＋PIN → 7. 私密清單 → 8. 正式版 APK 與金鑰備份
