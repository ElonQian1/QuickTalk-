@echo off
REM =============================================================
REM 已增加新的统一启动脚本： 在项目根目录可使用
REM   npm run backend:dev    （热重载 cargo watch）
REM   npm run dev            （前后端并行）
REM 本脚本保留仅供兼容或手动单独执行，不再推荐修改。
REM =============================================================
setlocal enableextensions enabledelayedexpansion

echo [dev] ========= Customer Service Backend (Rust) =========

REM Auto free port 8080 if occupied
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
  echo [dev] Port 8080 in use by PID %%p, killing...
  taskkill /F /PID %%p >nul 2>nul
)

REM Environment variables (override if already set externally)
if not defined DATABASE_URL set DATABASE_URL=sqlite:customer_service.db
if not defined JWT_SECRET set JWT_SECRET=your-super-secret-jwt-key
if not defined SERVER_HOST set SERVER_HOST=0.0.0.0
if not defined SERVER_PORT set SERVER_PORT=8080

echo [dev] DATABASE_URL=%DATABASE_URL%
echo [dev] Starting backend on %SERVER_HOST%:%SERVER_PORT%

where cargo >nul 2>nul
if errorlevel 1 (
  echo [dev][ERROR] Rust cargo 未找到，请先安装 Rust 工具链: https://www.rust-lang.org/tools/install
  exit /b 1
)

REM Faster incremental compile: reuse incremental artifacts
set RUST_LOG=info
echo [dev] Compiling & running (cargo run)...
cargo run

set EXIT_CODE=%ERRORLEVEL%
if not %EXIT_CODE%==0 (
  echo [dev][ERROR] 后端退出，代码: %EXIT_CODE%
) else (
  echo [dev] 后端正常退出。
)

endlocal
