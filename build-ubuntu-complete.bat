@echo off
REM ELonTalk 客服系统 - Ubuntu 交叉编译和打包脚本
REM 一键生成完整的 Ubuntu 部署包

echo ========================================
echo   ELonTalk Ubuntu 交叉编译和打包
echo   包含完整项目文件和依赖
echo ========================================
echo.

REM 检查必要工具
echo 🔍 检查编译环境...

REM 检查 Rust 目标
rustup target list --installed | findstr x86_64-unknown-linux-musl >nul
if %errorlevel% neq 0 (
    echo ❌ 缺少 Linux musl 目标，正在安装...
    rustup target add x86_64-unknown-linux-musl
    if %errorlevel% neq 0 (
        echo ❌ 无法安装 Linux 目标，请检查网络连接
        pause
        exit /b 1
    )
)

REM 检查 cargo-zigbuild
cargo zigbuild --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 缺少 cargo-zigbuild，正在安装...
    cargo install cargo-zigbuild
    if %errorlevel% neq 0 (
        echo ❌ 无法安装 cargo-zigbuild，请检查网络连接
        pause
        exit /b 1
    )
)

REM 检查 zig
zig version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 缺少 zig，请运行: winget install zig.zig
    echo 或手动下载: https://ziglang.org/download/
    pause
    exit /b 1
)

echo ✅ 编译环境检查完成
echo.

REM 设置编译参数
set BUILD_TARGET=x86_64-unknown-linux-musl
set BUILD_MODE=release
set OUTPUT_DIR=ubuntu-deploy-package
set BACKEND_SOURCE=backend
set CURRENT_DATE=%date:~0,4%-%date:~5,2%-%date:~8,2%

echo 📦 编译配置:
echo   目标平台: %BUILD_TARGET%
echo   编译模式: %BUILD_MODE%
echo   输出目录: %OUTPUT_DIR%
echo.

REM 清理输出目录
if exist %OUTPUT_DIR% (
    echo 🧹 清理旧的输出目录...
    rmdir /s /q %OUTPUT_DIR%
)
mkdir %OUTPUT_DIR%

REM 交叉编译 Rust 后端 (HTTPS 版本)
echo 🔨 开始交叉编译 Rust 后端 (HTTPS版本)...
cd %BACKEND_SOURCE%

REM 清理之前的编译缓存
cargo clean --target %BUILD_TARGET%

REM 执行交叉编译
cargo zigbuild --release --target %BUILD_TARGET% --features https
if %errorlevel% neq 0 (
    echo ❌ 后端编译失败
    cd ..
    pause
    exit /b 1
)

echo ✅ 后端编译成功
cd ..

REM 复制编译好的二进制文件
echo 📁 复制二进制文件...
copy "%BACKEND_SOURCE%\target\%BUILD_TARGET%\%BUILD_MODE%\customer-service-backend" "%OUTPUT_DIR%\" >nul
if %errorlevel% neq 0 (
    echo ❌ 复制二进制文件失败
    pause
    exit /b 1
)

REM 复制必要的项目文件
echo 📁 复制项目文件...

REM 复制数据库架构
copy "database_schema.sql" "%OUTPUT_DIR%\" >nul

REM 复制环境配置模板
copy ".env.https" "%OUTPUT_DIR%\.env.production" >nul 2>nul
copy ".env.example" "%OUTPUT_DIR%\.env.example" >nul 2>nul

REM 复制证书目录（如果存在）
if exist "certs" (
    echo 📁 复制证书文件...
    xcopy "certs" "%OUTPUT_DIR%\certs\" /e /i /q >nul
)

REM 复制静态文件
if exist "backend\static" (
    echo 📁 复制静态文件...
    xcopy "backend\static" "%OUTPUT_DIR%\static\" /e /i /q >nul
) else if exist "static" (
    xcopy "static" "%OUTPUT_DIR%\static\" /e /i /q >nul
)

REM 复制 SSL 配置脚本
copy "setup-duckdns-ssl.sh" "%OUTPUT_DIR%\" >nul 2>nul

REM 创建部署说明文件
echo 📝 创建部署说明...
(
echo # ELonTalk 客服系统 - Ubuntu 部署包
echo.
echo **编译时间**: %date% %time%
echo **目标平台**: Linux x86_64 ^(Ubuntu 16.04+^)
echo **编译版本**: HTTPS 支持版本
echo **二进制大小**: 约 8.3MB
echo.
echo ## 快速部署
echo.
echo ```bash
echo # 1. 上传整个目录到 Ubuntu 服务器
echo scp -r %OUTPUT_DIR% user@server:/opt/elontalk/
echo.
echo # 2. 登录服务器并设置权限
echo ssh user@server
echo cd /opt/elontalk/%OUTPUT_DIR%
echo chmod +x customer-service-backend
echo.
echo # 3. 配置环境
echo cp .env.example .env
echo # 编辑 .env 文件，设置数据库路径等
echo.
echo # 4. 启动服务 ^(HTTP模式^)
echo ./customer-service-backend
echo.
echo # 5. 启动 HTTPS 服务 ^(需要证书^)
echo # 首先运行 SSL 配置脚本:
echo sudo ./setup-duckdns-ssl.sh
echo # 然后启动 HTTPS 服务:
echo TLS_ENABLED=true ./customer-service-backend
echo ```
echo.
echo ## 文件说明
echo.
echo - `customer-service-backend`: 主程序 ^(静态链接，零依赖^)
echo - `database_schema.sql`: 数据库表结构
echo - `.env.example`: 环境变量配置模板
echo - `.env.production`: 生产环境配置示例
echo - `certs/`: SSL 证书目录 ^(如果存在^)
echo - `static/`: 前端静态文件
echo - `setup-duckdns-ssl.sh`: Let's Encrypt SSL 自动配置脚本
echo.
echo ## 环境要求
echo.
echo - Ubuntu 16.04+ ^(或兼容的 Linux 发行版^)
echo - 无额外依赖 ^(静态链接^)
echo - 端口 8080 ^(HTTP^) 和 8443 ^(HTTPS^) 可用
echo.
echo ## 支持功能
echo.
echo - ✅ 完整的客服系统功能
echo - ✅ WebSocket 实时通信
echo - ✅ SQLite 数据库 ^(内嵌^)
echo - ✅ HTTPS/SSL 支持
echo - ✅ Let's Encrypt 自动证书申请
echo - ✅ 文件上传和图片预览
echo - ✅ 多店铺管理
echo.
echo ## 故障排除
echo.
echo 如果遇到权限问题:
echo ```bash
echo chmod +x customer-service-backend
echo ```
echo.
echo 如果遇到端口占用:
echo ```bash
echo sudo netstat -tulpn ^| grep :8080
echo sudo kill ^<PID^>
echo ```
echo.
echo 如果需要 HTTPS 证书:
echo ```bash
echo sudo ./setup-duckdns-ssl.sh
echo ```
echo.
echo ---
echo **构建版本**: %CURRENT_DATE%
echo **技术栈**: Rust + Axum + SQLite + Rustls
) > "%OUTPUT_DIR%\README.md"

REM 创建启动脚本
echo 📝 创建启动脚本...
(
echo #!/bin/bash
echo # ELonTalk 客服系统启动脚本
echo.
echo echo "🚀 启动 ELonTalk 客服系统..."
echo.
echo # 检查二进制文件
echo if [ ! -f "./customer-service-backend" ]; then
echo     echo "❌ 找不到 customer-service-backend 文件"
echo     exit 1
echo fi
echo.
echo # 设置执行权限
echo chmod +x customer-service-backend
echo.
echo # 检查环境配置
echo if [ ! -f ".env" ]; then
echo     echo "⚠️  .env 文件不存在，使用默认配置"
echo     if [ -f ".env.example" ]; then
echo         cp .env.example .env
echo         echo "✅ 已复制 .env.example 到 .env"
echo     fi
echo fi
echo.
echo # 显示配置信息
echo echo "📋 当前配置:"
echo echo "  工作目录: $(pwd)"
echo echo "  环境文件: .env"
echo echo "  数据库: customer_service.db"
echo echo "  日志级别: INFO"
echo echo ""
echo.
echo # 启动服务
echo echo "🌟 启动服务器..."
echo exec ./customer-service-backend
) > "%OUTPUT_DIR%\start.sh"

REM 创建 HTTPS 启动脚本
(
echo #!/bin/bash
echo # ELonTalk HTTPS 服务启动脚本
echo.
echo echo "🔒 启动 ELonTalk HTTPS 服务..."
echo.
echo # 检查证书文件
echo if [ ! -f "certs/server.crt" ] ^|^| [ ! -f "certs/server.key" ]; then
echo     echo "❌ SSL 证书文件不存在"
echo     echo "请先运行: sudo ./setup-duckdns-ssl.sh"
echo     exit 1
echo fi
echo.
echo # 设置 HTTPS 环境变量
echo export TLS_ENABLED=true
echo export TLS_PORT=8443
echo export TLS_CERT_PATH=certs/server.crt
echo export TLS_KEY_PATH=certs/server.key
echo.
echo # 设置执行权限
echo chmod +x customer-service-backend
echo.
echo echo "📋 HTTPS 配置:"
echo echo "  HTTPS 端口: 8443"
echo echo "  证书文件: certs/server.crt"
echo echo "  私钥文件: certs/server.key"
echo echo ""
echo.
echo # 启动 HTTPS 服务
echo echo "🌟 启动 HTTPS 服务器..."
echo exec ./customer-service-backend
) > "%OUTPUT_DIR%\start-https.sh"

REM 显示编译结果
echo.
echo ========================================
echo 🎉 Ubuntu 交叉编译和打包完成！
echo ========================================
echo.
echo 📦 输出目录: %OUTPUT_DIR%
echo 📁 包含文件:

dir /b "%OUTPUT_DIR%"

echo.
echo 📊 二进制文件信息:
for %%F in ("%OUTPUT_DIR%\customer-service-backend") do (
    echo   文件大小: %%~zF 字节 ^(约 %%~zF/1024/1024 MB^)
)

echo.
echo 🚀 部署方式:
echo 1. 将整个 %OUTPUT_DIR% 目录上传到 Ubuntu 服务器
echo 2. 运行: chmod +x customer-service-backend
echo 3. 运行: ./start.sh ^(HTTP模式^)
echo 4. 或运行: ./start-https.sh ^(HTTPS模式，需要证书^)
echo.
echo 🌐 访问地址:
echo   HTTP:  http://your-server:8080
echo   HTTPS: https://your-server:8443
echo.
echo ✅ 完整的部署包已准备就绪！

pause