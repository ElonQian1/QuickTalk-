@echo off
REM Ubuntu交叉编译脚本 - Windows版本
REM 编译Linux x86_64二进制文件并打包部署

echo ========================================
echo   客服系统 - Ubuntu交叉编译打包
echo ========================================
echo.

REM 检查Rust工具链
echo 🔍 检查Rust环境...
rustc --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Rust工具链
    echo 请安装Rust: https://rustup.rs/
    pause
    exit /b 1
)

REM 检查交叉编译目标
echo 🔍 检查Linux目标支持...
rustup target list --installed | findstr "x86_64-unknown-linux-musl" >nul
if %errorlevel% neq 0 (
    echo 📦 安装Linux musl目标...
    rustup target add x86_64-unknown-linux-musl
    if %errorlevel% neq 0 (
        echo ❌ 安装Linux目标失败
        pause
        exit /b 1
    )
)

REM 设置环境变量
set PKG_CONFIG_ALLOW_CROSS=1
set SQLX_OFFLINE=true

REM 进入后端目录
cd backend
if %errorlevel% neq 0 (
    echo ❌ 错误: 找不到backend目录
    pause
    exit /b 1
)

echo.
echo 🔨 开始交叉编译...
echo 目标: x86_64-unknown-linux-musl (静态链接)
echo 特性: https支持
echo.

REM 交叉编译 (使用musl为静态链接，部署更简单)
cargo build --release --target x86_64-unknown-linux-musl --features https
if %errorlevel% neq 0 (
    echo ❌ 编译失败
    pause
    exit /b 1
)

echo ✅ 编译完成!
echo.

REM 创建部署目录
set DEPLOY_DIR=ubuntu-deploy
echo 📦 创建部署包...
if exist %DEPLOY_DIR% (
    echo 清理旧的部署目录...
    rmdir /s /q %DEPLOY_DIR%
)
mkdir %DEPLOY_DIR%

REM 复制二进制文件
echo 📋 复制二进制文件...
copy target\x86_64-unknown-linux-musl\release\customer-service-backend.exe %DEPLOY_DIR%\customer-service-backend >nul
if %errorlevel% neq 0 (
    echo ❌ 复制二进制文件失败
    pause
    exit /b 1
)

REM 复制数据库文件
echo 📋 复制数据库文件...
if exist customer_service.db (
    copy customer_service.db %DEPLOY_DIR%\ >nul
) else (
    echo ⚠️  数据库文件不存在，创建空数据库文件标记
    echo. > %DEPLOY_DIR%\customer_service.db
)

REM 复制数据库架构
if exist ..\database_schema.sql (
    copy ..\database_schema.sql %DEPLOY_DIR%\ >nul
    echo ✅ 复制数据库架构文件
) else (
    echo ⚠️  未找到数据库架构文件
)

REM 复制SSL证书（如果存在）
echo 📋 复制SSL证书...
if exist ..\certs (
    mkdir %DEPLOY_DIR%\certs
    if exist ..\certs\server.crt (
        copy ..\certs\server.crt %DEPLOY_DIR%\certs\ >nul
        echo ✅ 复制SSL证书
    )
    if exist ..\certs\server.key (
        copy ..\certs\server.key %DEPLOY_DIR%\certs\ >nul
        echo ✅ 复制SSL私钥
    )
    if not exist ..\certs\server.crt (
        echo ⚠️  SSL证书不存在，请在服务器上运行 setup-duckdns-ssl.sh
    )
) else (
    mkdir %DEPLOY_DIR%\certs
    echo ⚠️  证书目录不存在，创建空目录
)

REM 复制静态文件
echo 📋 复制静态文件...
if exist static (
    xcopy static %DEPLOY_DIR%\static\ /e /i /q >nul
    echo ✅ 复制静态文件
) else (
    echo ⚠️  静态文件目录不存在
)

REM 创建环境配置文件
echo 📋 创建环境配置...
(
echo # Ubuntu部署环境配置
echo # 生产环境设置
echo.
echo # 基本配置
echo DATABASE_URL=sqlite:customer_service.db
echo JWT_SECRET=production-super-secret-jwt-key-2024
echo SERVER_HOST=0.0.0.0
echo SERVER_PORT=8080
echo.
echo # HTTPS配置 ^(需要先运行SSL脚本^)
echo TLS_ENABLED=true
echo TLS_PORT=8443
echo TLS_CERT_PATH=certs/server.crt
echo TLS_KEY_PATH=certs/server.key
echo TLS_DOMAIN=elontalk.duckdns.org
echo TLS_REDIRECT_HTTP=true
echo.
echo # 生产优化
echo RUST_LOG=info
echo CORS_ALLOWED_ORIGINS=https://elontalk.duckdns.org
) > %DEPLOY_DIR%\.env.production

REM 复制SSL配置脚本
echo 📋 复制SSL配置脚本...
if exist ..\setup-duckdns-ssl.sh (
    copy ..\setup-duckdns-ssl.sh %DEPLOY_DIR%\ >nul
    echo ✅ 复制SSL配置脚本
)

REM 创建启动脚本
echo 📋 创建启动脚本...
(
echo #!/bin/bash
echo # Ubuntu服务器启动脚本
echo.
echo echo "🚀 启动客服系统服务器..."
echo echo "📋 配置信息:"
echo echo "  - 二进制文件: customer-service-backend"
echo echo "  - 配置文件: .env.production"
echo echo "  - 数据库: customer_service.db"
echo echo "  - 证书目录: certs/"
echo echo.
echo.
echo # 检查配置文件
echo if [ ! -f .env.production ]; then
echo     echo "❌ 配置文件 .env.production 不存在"
echo     exit 1
echo fi
echo.
echo # 复制生产配置
echo cp .env.production .env
echo echo "✅ 已加载生产环境配置"
echo.
echo # 设置执行权限
echo chmod +x customer-service-backend
echo.
echo # 检查HTTPS证书
echo if [ -f certs/server.crt ] ^&^& [ -f certs/server.key ]; then
echo     echo "✅ 发现SSL证书，启用HTTPS模式"
echo     echo "🌐 访问地址: https://elontalk.duckdns.org:8443"
echo else
echo     echo "⚠️  未发现SSL证书"
echo     echo "💡 请先运行: sudo ./setup-duckdns-ssl.sh"
echo     echo "🌐 或临时使用HTTP: http://your-server:8080"
echo fi
echo.
echo echo "🚀 启动服务器..."
echo ./customer-service-backend
) > %DEPLOY_DIR%\start-server.sh

REM 创建README
echo 📋 创建部署说明...
(
echo # Ubuntu服务器部署指南
echo.
echo ## 📦 包含文件
echo - `customer-service-backend`: 主程序^(Linux静态链接二进制^)
echo - `.env.production`: 生产环境配置
echo - `start-server.sh`: 启动脚本
echo - `setup-duckdns-ssl.sh`: SSL证书配置脚本
echo - `database_schema.sql`: 数据库架构
echo - `certs/`: SSL证书目录
echo - `static/`: 静态文件
echo.
echo ## 🚀 部署步骤
echo.
echo ### 1. 上传文件
echo ```bash
echo # 上传整个ubuntu-deploy目录到服务器
echo scp -r ubuntu-deploy/ user@your-server:/path/to/deploy/
echo ```
echo.
echo ### 2. 设置权限
echo ```bash
echo cd /path/to/deploy/ubuntu-deploy/
echo chmod +x customer-service-backend
echo chmod +x start-server.sh
echo chmod +x setup-duckdns-ssl.sh
echo ```
echo.
echo ### 3. 配置SSL^(推荐^)
echo ```bash
echo # 申请Let's Encrypt免费SSL证书
echo sudo ./setup-duckdns-ssl.sh
echo ```
echo.
echo ### 4. 启动服务器
echo ```bash
echo # 使用启动脚本
echo ./start-server.sh
echo.
echo # 或直接运行
echo cp .env.production .env
echo ./customer-service-backend
echo ```
echo.
echo ## 🌐 访问地址
echo - **HTTPS**: https://elontalk.duckdns.org:8443 ^(配置SSL后^)
echo - **HTTP**: http://your-server-ip:8080 ^(备用^)
echo.
echo ## 🔧 故障排除
echo - 检查防火墙: `sudo ufw allow 8443` `sudo ufw allow 8080`
echo - 查看日志: 服务器会输出详细日志
echo - 检查端口: `netstat -tuln | grep 8443`
echo.
echo ## 📝 生产环境优化
echo 建议使用systemd服务管理:
echo ```bash
echo # 创建服务文件
echo sudo nano /etc/systemd/system/customer-service.service
echo # 启用开机自启
echo sudo systemctl enable customer-service
echo sudo systemctl start customer-service
echo ```
) > %DEPLOY_DIR%\README.md

REM 显示文件大小信息
echo.
echo 📊 部署包信息:
for %%f in (%DEPLOY_DIR%\customer-service-backend) do (
    echo   二进制大小: %%~zf bytes
)
echo   部署目录: %cd%\%DEPLOY_DIR%\

echo.
echo 🎊 打包完成！
echo.
echo 📂 部署文件位置: %cd%\%DEPLOY_DIR%\
echo 📖 部署说明: %DEPLOY_DIR%\README.md
echo 🚀 启动脚本: %DEPLOY_DIR%\start-server.sh
echo 🔐 SSL配置: %DEPLOY_DIR%\setup-duckdns-ssl.sh
echo.
echo 💡 下一步:
echo 1. 将 %DEPLOY_DIR%\ 目录上传到Ubuntu服务器
echo 2. 运行 sudo ./setup-duckdns-ssl.sh 配置SSL
echo 3. 运行 ./start-server.sh 启动服务器
echo.

pause