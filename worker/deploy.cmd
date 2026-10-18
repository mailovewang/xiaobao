@echo off
rem 部署推播服務到 Cloudflare，並上傳 Firebase 服務帳戶金鑰（金鑰只放在電腦的 .secrets 資料夾）
cd /d "%~dp0"
call npx.cmd wrangler deploy
if errorlevel 1 exit /b 1
if exist ..\.secrets\service-account.json (
  type ..\.secrets\service-account.json | npx.cmd wrangler secret put SERVICE_ACCOUNT
)
