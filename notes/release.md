# 發布流程

原始檔在 `web/`，GitHub Pages 發布的是 `docs/`。

1. 改 `web/` 裡的程式，用 `.claude/launch.json` 的 web 在瀏覽器測
2. `node scripts/publish.mjs beta` → commit + push → 麥麥手機開「測試版」試
   - 開關：App「更多」頁連點版本號 5 下
3. 沒問題再 `node scripts/publish.mjs stable` → commit + push → 兩個人都更新
4. 壞掉要退回：`git revert` 那次 commit 再 push

# 備份

`node scripts/backup.mjs`：匯出資料庫＋簽章金鑰＋推播金鑰到 `backups/`，並複製到 OneDrive。
小寶的私密清單、記帳和所有 PIN 不會放進備份檔。
