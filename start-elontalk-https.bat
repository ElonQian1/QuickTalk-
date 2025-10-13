@echo off
REM ELonTalk HTTPS 启动脚本
REM 域名: elontalk.duckdns.org

echo ======================================
echo   ELonTalk 客服系统 - HTTPS 模式
echo   域名: elontalk.duckdns.org
echo ======================================
echo.

REM 检查是否存在证书文件
if not exist "certs\server.crt" (
    echo ❌ 未找到SSL证书文件!
    echo.
    echo 请先生成证书:
    echo 1. 以管理员身份运行 PowerShell
    echo 2. 执行: .\generate-certificate.ps1
    echo.
    echo 或者手动放置证书文件到 certs\ 目录:
    echo - certs\server.crt ^(证书文件^)
    echo - certs\server.key ^(私钥文件^)
    echo.
    pause
    exit /b 1
)

REM 检查 .env 配置文件
if not exist ".env" (
    echo ℹ️ 未找到 .env 文件，使用 HTTPS 配置...
    copy ".env.https" ".env"
    echo ✅ 已复制 HTTPS 配置到 .env
)

echo 🔐 启动 HTTPS 模式...
echo.
echo 配置信息:
echo - 域名: elontalk.duckdns.org  
echo - HTTPS端口: 8443
echo - HTTP重定向: 启用
echo - 证书: certs\server.crt
echo.

cd backend

REM 检查 Rust 是否可用
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未找到 Rust/Cargo!
    echo 请先安装 Rust: https://rustup.rs/
    pause
    exit /b 1
)

echo 🚀 编译并启动 Rust 后端 (HTTPS 模式)...
echo.

REM 启动 HTTPS 服务器
cargo run --features https --release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 🎉 服务器已停止
) else (
    echo.
    echo ❌ 服务器启动失败!
    echo.
    echo 可能的原因:
    echo 1. 端口 8443 被占用
    echo 2. 证书文件格式错误
    echo 3. 权限不足 ^(需要管理员权限绑定443端口^)
)

cd ..
pause