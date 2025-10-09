@echo off
echo ================================
echo    客服系统开发环境启动器
echo ================================
echo.
echo 正在启动后端服务器...
cd /d "%~dp0\backend"
set DATABASE_URL=sqlite:customer_service.db
set JWT_SECRET=your-super-secret-jwt-key
set SERVER_HOST=0.0.0.0
set SERVER_PORT=8080

echo 后端配置:
echo - 数据库: %DATABASE_URL%
echo - 端口: %SERVER_PORT%
echo - 主机: %SERVER_HOST%
echo.

echo 启动 Rust 服务器...
cargo run

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 错误: 后端服务器启动失败
    echo 错误代码: %ERRORLEVEL%
    echo.
    echo 可能的解决方案:
    echo 1. 检查端口 8080 是否被占用
    echo 2. 确认已安装 Rust 工具链（cargo）
    echo 3. 检查数据库文件权限
    pause
    exit /b 1
)

pause