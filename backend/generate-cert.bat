@echo off
REM 自签名SSL证书生成脚本 (开发环境使用)
REM 需要安装 OpenSSL 或 Git Bash (带OpenSSL)

echo 🔐 正在生成自签名SSL证书...

REM 创建证书目录
if not exist "certs" mkdir certs

REM 生成私钥和证书
openssl req -x509 -newkey rsa:4096 ^
    -keyout certs/server.key ^
    -out certs/server.crt ^
    -days 365 ^
    -nodes ^
    -subj "/CN=localhost/O=Development/C=US"

if %errorlevel% equ 0 (
    echo ✅ SSL证书生成成功！
    echo 📁 证书文件位置:
    echo    私钥: certs/server.key
    echo    证书: certs/server.crt
    echo.
    echo 🚀 现在可以启动HTTPS服务器:
    echo    cargo run --features https
) else (
    echo ❌ 证书生成失败！
    echo 💡 请检查是否安装了OpenSSL
    echo    Windows用户可以通过以下方式安装:
    echo    1. 安装Git for Windows (包含OpenSSL)
    echo    2. 安装Chocolatey并运行: choco install openssl
    echo    3. 下载OpenSSL for Windows
)

pause