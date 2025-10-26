@echo off
setlocal ENABLEDELAYEDEXPANSION

title StarWriter Engine 一键安装启动 (Windows)
echo ===============================================
echo   StarWriter Engine 一键安装啟动 (Windows)
echo   本脚本将自动檢查 Node.js、安装依赖并启动
echo ===============================================
echo.

rem 切换到项目根目录（脚本位于 scripts/ 下）
cd /d "%~dp0\.."

call :check_node
if %ERRORLEVEL% NEQ 0 call :install_node

call :check_node
if %ERRORLEVEL% NEQ 0 (
  echo [错误] Node.js 未安装成功，请手动安装 https://nodejs.org 后重试。
  pause
  exit /b 1
)

echo.
echo [1/3] 安装依赖...
call npm install || call npm ci
if %ERRORLEVEL% NEQ 0 (
  echo [错误] 依赖安装失败，请检查网络或代理设置。
  pause
  exit /b 1
)

echo.
echo [2/3] 可选：检测代理配置...
if defined HTTPS_PROXY echo 已检测到 HTTPS_PROXY: %HTTPS_PROXY%
if defined HTTP_PROXY echo 已检测到 HTTP_PROXY: %HTTP_PROXY%

echo.
echo [3/3] 启动开发服务器...
start "" http://localhost:9002
call npm run dev
goto :eof

:check_node
where node >nul 2>nul && where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  for /f "tokens=2 delims=v " %%v in ('node -v') do set NODE_VER=%%v
  echo [OK] Node.js 已安装: %NODE_VER%
  exit /b 0
) else (
  echo [提示] 未检测到 Node.js，将尝试自动安装...
  exit /b 1
)

:install_node
where winget >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo [安装] 使用 winget 安装 Node.js LTS...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements || goto :install_fallback
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)

:install_fallback
echo [安装] 下载安装包（可能需要管理员确认）...
set "MSI=%TEMP%\node-lts.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/latest-v18.x/node-v18.18.2-x64.msi' -OutFile '%MSI%'; exit 0 } catch { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
  echo [错误] 无法下载 Node.js 安装包，请手动前往 https://nodejs.org 下载并安装。
  exit /b 1
)
start "" "%MSI%"
echo 请完成 Node.js 安装向导后按任意键继续...
pause >nul

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
exit /b 0


