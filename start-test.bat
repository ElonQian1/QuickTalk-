@echo off
chcp 65001 >nul
echo.
echo =====================================================
echo    🚀 客服系统远程测试环境启动器
echo =====================================================
echo.

echo 📋 准备启动测试环境...
echo.

echo ✅ 第1步: 启动本地客服服务器...
echo    服务器地址: http://localhost:3030
echo.
start "客服服务器" cmd /k "cd /d %~dp0 && echo 🚀 正在启动客服服务器... && npm start"

echo ⏳ 等待服务器启动...
timeout /t 5 >nul

echo.
echo ✅ 第2步: 准备启动内网穿透...
echo    这将让您的朋友网站能够访问您的本地服务器
echo.

choice /c YN /m "是否启动 ngrok 内网穿透"
if errorlevel 2 goto manual_tunnel
if errorlevel 1 goto start_ngrok

:start_ngrok
echo.
echo 🌐 启动 ngrok 内网穿透...
start "Ngrok内网穿透" cmd /k "echo 🌐 正在启动内网穿透... && ngrok http 3030"
goto instructions

:manual_tunnel
echo.
echo 📝 手动启动内网穿透:
echo    方法1: ngrok http 3030
echo    方法2: lt --port 3030
echo    方法3: ssh -R 80:localhost:3030 serveo.net
echo.

:instructions
echo.
echo =====================================================
echo    📋 接下来的操作步骤
echo =====================================================
echo.
echo 🔗 1. 从 ngrok 窗口复制公网地址 (类似: https://abc123.ngrok.io)
echo.
echo 📝 2. 修改测试代码:
echo       打开: friend-website-test-code.html
echo       找到: const TEST_SERVER_URL = 'http://localhost:3030';
echo       改为: const TEST_SERVER_URL = '您的ngrok地址';
echo.
echo 📤 3. 将修改后的代码发给您的朋友
echo.
echo 🌐 4. 朋友将代码添加到他的网站
echo.
echo 🧪 5. 访问朋友的网站测试客服功能
echo.
echo ⚠️  测试期间请保持这些窗口开启！
echo.

pause
echo.
echo 测试环境已准备就绪！
echo 按任意键关闭此窗口...
pause >nul
