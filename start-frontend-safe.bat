@echo off
echo ================================
echo    前端开发服务器启动器
echo ================================
echo.
echo 正在启动前端开发服务器...
cd /d "%~dp0\frontend"

echo 检查 node_modules...
if not exist "node_modules" (
    echo 警告: node_modules 不存在，正在安装依赖...
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
)

echo 启动 React 开发服务器...
echo 前端将在 http://localhost:3000 启动
npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 错误: 前端服务器启动失败
    echo 错误代码: %ERRORLEVEL%
    echo.
    echo 可能的解决方案:
    echo 1. 检查端口 3000 是否被占用
    echo 2. 运行 npm install 安装依赖
    echo 3. 检查 package.json 配置
    pause
    exit /b 1
)

pause