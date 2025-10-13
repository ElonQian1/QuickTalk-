@echo off
REM 为 ELonTalk 生成自签名证书

echo 正在为 elontalk.duckdns.org 生成自签名证书...

REM 检查 OpenSSL 是否可用
where openssl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 错误: 未找到 OpenSSL
    echo 请安装 OpenSSL 或使用在线证书生成工具
    echo.
    echo 推荐安装方式:
    echo 1. 下载 Git for Windows ^(包含 OpenSSL^)
    echo 2. 或从 https://slproweb.com/products/Win32OpenSSL.html 下载
    echo.
    echo 临时解决方案: 使用以下在线工具生成证书
    echo https://certificatetools.com/
    echo 域名: elontalk.duckdns.org
    pause
    exit /b 1
)

REM 生成私钥
openssl genrsa -out certs\server.key 2048

REM 生成证书
openssl req -new -x509 -key certs\server.key -out certs\server.crt -days 365 -subj "/CN=elontalk.duckdns.org"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ 证书生成成功!
    echo 证书文件: certs\server.crt
    echo 私钥文件: certs\server.key
    echo.
    echo 证书信息:
    openssl x509 -in certs\server.crt -text -noout | findstr "Subject:"
    openssl x509 -in certs\server.crt -text -noout | findstr "Not Before:"
    openssl x509 -in certs\server.crt -text -noout | findstr "Not After:"
    echo.
    echo 下一步: 复制 .env.https 到 .env 然后启动应用
) else (
    echo ❌ 证书生成失败
)

pause