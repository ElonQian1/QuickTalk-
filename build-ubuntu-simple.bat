@echo off
REM 精简版 Ubuntu 交叉编译脚本

echo 🔨 ELonTalk Ubuntu 交叉编译 - 精简版
echo.

REM 快速环境检查
cargo zigbuild --version >nul 2>&1 || (
    echo ❌ 需要安装 cargo-zigbuild
    echo 运行: cargo install cargo-zigbuild
    pause & exit /b 1
)

rustup target list --installed | findstr x86_64-unknown-linux-musl >nul || (
    echo 🔧 安装 Linux 目标...
    rustup target add x86_64-unknown-linux-musl
)

echo ✅ 环境检查通过
echo.

REM 交叉编译
echo 🔨 开始编译...
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https

if %errorlevel% equ 0 (
    echo.
    echo ✅ 编译成功！
    echo 📁 输出文件: target\x86_64-unknown-linux-musl\release\customer-service-backend
    
    REM 显示文件大小
    for %%F in ("target\x86_64-unknown-linux-musl\release\customer-service-backend") do (
        set /a size_mb=%%~zF/1024/1024
        echo 📊 文件大小: %%~zF 字节 ^(约 !size_mb! MB^)
    )
    
    REM 复制到 ubuntu-deploy 目录
    copy "target\x86_64-unknown-linux-musl\release\customer-service-backend" "..\ubuntu-deploy\" >nul
    echo 📦 已复制到 ubuntu-deploy 目录
) else (
    echo ❌ 编译失败
)

cd ..
pause
