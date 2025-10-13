@echo off
chcp 65001 > nul
echo ========================================
echo   Backend HTTPS 开发测试
echo ========================================
echo.
echo 🔧 HTTPS 配置:
echo   端口: 8443
echo   证书: certs/server.crt
echo   私钥: certs/server.key
echo   域名: localhost
echo.
echo 🚀 启动 Backend HTTPS 服务器...

cd /d "%~dp0backend"

set TLS_ENABLED=true
set TLS_PORT=8443
set TLS_CERT_PATH=../certs/server.crt
set TLS_KEY_PATH=../certs/server.key
set TLS_REDIRECT_HTTP=false
set DATABASE_URL=sqlite:customer_service.db
set JWT_SECRET=dev-secret-key-12345

cargo run --features https

echo.
echo 🎉 服务器已停止
pause