@echo off
REM 开发模式 HTTPS 启动脚本
REM 使用自签名证书进行本地HTTPS测试

echo ========================================
echo   ELonTalk 客服系统 - 开发模式 HTTPS
echo   本地测试 - 自签名证书
echo ========================================
echo.

REM 检查证书文件
if not exist "certs\server.crt" (
    echo ❌ 未找到证书文件!
    echo 请先运行: .\generate-certificate.ps1
    pause
    exit /b 1
)

if not exist "certs\server.key" (
    echo ❌ 未找到私钥文件!
    echo 请先运行: .\convert-certificate.ps1
    pause
    exit /b 1
)

REM 复制开发配置 - 使用专门的HTTPS开发配置
if exist ".env.dev.https" (
    copy ".env.dev.https" ".env" >nul
    echo ✅ 已加载开发环境HTTPS配置
) else (
    copy ".env.dev" ".env" >nul
    echo ✅ 已加载开发环境配置
)

echo.
echo 🔐 开发模式 HTTPS 配置:
echo - 本地地址: https://localhost:8443
echo - 测试地址: https://127.0.0.1:8443
echo - HTTP重定向: 启用 (8080 -> 8443)
echo - 证书类型: 自签名 (开发用)
echo.
echo ⚠️  浏览器安全警告:
echo    浏览器会显示"连接不安全"警告
echo    点击"高级" → "继续前往localhost"即可
echo.

cd backend

echo 🚀 启动开发服务器 (HTTPS模式)...
echo.

REM 启动 HTTPS 开发服务器
cargo run --features https

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 🎉 开发服务器已停止
) else (
    echo.
    echo ❌ 服务器启动失败!
    echo 请检查端口8443是否被占用
)

cd ..
pause
