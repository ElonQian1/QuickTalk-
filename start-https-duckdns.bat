@echo off
REM Windows版本的HTTPS启动脚本

echo 启动客服系统 (HTTPS模式)...

REM 检查证书文件
if not exist "certs\server.crt" (
    echo 错误: 未找到SSL证书文件
    echo 请先运行证书配置脚本
    pause
    exit /b 1
)

REM 设置环境变量
set HTTPS_ENABLED=true
set HTTPS_PORT=8443
set TLS_CERT_PATH=certs/server.crt
set TLS_KEY_PATH=certs/server.key
set REDIRECT_HTTP=true

REM 启动后端 (HTTPS模式)
echo 启动Rust后端服务器...
cd backend
cargo run --features https --release
cd ..

pause