@echo off
REM 启动带 HTTPS 支持的客服系统

echo 🚀 启动客服系统 (HTTPS模式)...

REM 检查.env文件
if not exist ".env" (
    echo ⚠️  .env 文件不存在，使用默认配置
    echo 📝 建议复制 .env.example 为 .env 并配置 HTTPS 选项
    echo.
)

REM 设置 HTTPS 环境变量
set TLS_ENABLED=true
set TLS_AUTO_GENERATE=true
set TLS_CERT_PATH=cert.pem
set TLS_KEY_PATH=key.pem
set TLS_PORT=8443
set TLS_REDIRECT_HTTP=true
set TLS_DOMAIN=localhost

echo 🔒 HTTPS配置:
echo   启用HTTPS: %TLS_ENABLED%
echo   自动生成证书: %TLS_AUTO_GENERATE%
echo   证书: %TLS_CERT_PATH%
echo   私钥: %TLS_KEY_PATH%
echo   端口: %TLS_PORT%
echo   HTTP重定向: %TLS_REDIRECT_HTTP%
echo   域名: %TLS_DOMAIN%
echo.

echo 📋 可用的启动方式:
echo   1. 完整开发环境 (推荐): npm run dev:https
echo   2. 仅HTTPS后端: npm run dev:https-only  
echo   3. 仅后端构建: cd backend && cargo run --features https
echo.

REM 使用npm启动完整开发环境
echo 🚀 启动完整HTTPS开发环境...
npm run dev:https

pause