@echo off
echo 启动客服系统...

echo.
echo 启动后端服务...
cd /d "%~dp0backend"
start "Backend Server" cmd /k "cargo run"

echo 等待后端服务启动...
timeout /t 5

echo.
echo 启动前端服务...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo 安装前端依赖...
    call npm install
)
start "Frontend Server" cmd /k "npm start"

echo.
echo 系统启动完成！
echo 后端服务: http://localhost:8080
echo 前端服务: http://localhost:3000
echo.
echo 按任意键退出...
pause