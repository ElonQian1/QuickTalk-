@echo off
chcp 65001 >nul

echo 🚀 开始更新前端文件...

REM 检查是否在项目根目录
if not exist "frontend" (
    echo ❌ 错误: 请在项目根目录中运行此脚本
    pause
    exit /b 1
)

echo 📦 重新构建前端...
call npm run build:frontend
if errorlevel 1 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)

echo 📁 更新部署包中的静态文件...
rmdir /s /q "ubuntu-deploy-ready\static" 2>nul
mkdir "ubuntu-deploy-ready\static"
xcopy "frontend\build\*" "ubuntu-deploy-ready\static\" /s /e /q

echo ✅ 前端更新完成!
echo 💡 提示: 
echo   - 前端已配置为自动适配访问地址
echo   - 支持动态IP环境
echo   - 将 ubuntu-deploy-ready 目录上传到服务器即可

pause