@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   SCOUT 上传到 Cloudflare Pages (myscout)
echo ============================================
echo.
echo 正在执行类型、测试、构建和安全检查...
call npm run verify
if errorlevel 1 (
  echo 验证失败，已停止发布。
  pause
  exit /b 1
)
call npm run audit:security
if errorlevel 1 (
  echo 依赖审计未通过，已停止发布。
  pause
  exit /b 1
)
echo 正在部署（首次会下载工具并弹出浏览器授权，点 Allow）...
echo.
call npx --yes wrangler@4.128.0 pages deploy dist --project-name myscout --branch main --commit-dirty=true > "%~dp0deploy-log.txt" 2>&1
notepad "%~dp0deploy-log.txt"
echo.
echo 日志已用记事本打开。若末尾显示部署地址即为成功。
pause
