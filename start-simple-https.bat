@echo off
REM 简化版 HTTPS 开发启动脚本
REM 仅启动HTTPS，不启动HTTP重定向

echo ========================================
echo   简化版 HTTPS 开发测试
echo ========================================
echo.

REM 设置环境变量
set TLS_ENABLED=true
set TLS_PORT=8443
set TLS_CERT_PATH=certs/server.crt
set TLS_KEY_PATH=certs/server.key
set TLS_REDIRECT_HTTP=false
set TLS_DOMAIN=localhost

echo 📋 HTTPS 配置:
echo   端口: 8443
echo   证书: certs/server.crt
echo   重定向: 禁用
echo   域名: localhost
echo.

cd backend

echo 🚀 启动简化版 HTTPS 服务器...
cargo run --features https

cd ..
echo.
echo 🎉 服务器已停止
pause