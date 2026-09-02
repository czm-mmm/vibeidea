@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   SCOUT 上传到 Cloudflare Pages (myscout)
echo ============================================
echo.
echo 正在部署（首次会下载工具并弹出浏览器授权，点 Allow）...
echo.
npx wrangler pages deploy dist --project-name myscout --branch main --commit-dirty=true > "%~dp0deploy-log.txt" 2>&1
notepad "%~dp0deploy-log.txt"
echo.
echo 日志已用记事本打开。若末尾显示部署地址即为成功。
pause
