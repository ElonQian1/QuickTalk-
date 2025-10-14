@echo off
chcp 65001 >nul

REM ==============================================
REM 数据库Schema同步脚本 (Windows)
REM 用途: 同步 backend/src/schema.sql 到部署包
REM ==============================================

set SOURCE=backend\src\schema.sql
set TARGET=ubuntu-deploy-complete\database_schema.sql

echo ==============================================
echo 数据库Schema同步工具
echo ==============================================
echo.

REM 检查源文件
if not exist "%SOURCE%" (
    echo ❌ 错误: 找不到源文件 %SOURCE%
    exit /b 1
)

REM 检查目标目录
if not exist "ubuntu-deploy-complete" (
    echo ⚠️  创建目标目录...
    mkdir ubuntu-deploy-complete
)

REM 如果目标文件存在，检查差异
if exist "%TARGET%" (
    fc /b "%SOURCE%" "%TARGET%" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Schema文件已经是最新的，无需同步
        echo.
        exit /b 0
    ) else (
        echo ⚠️  检测到Schema文件差异
        echo.
        set /p confirm="是否要同步? (y/n): "
        if /i not "!confirm!"=="y" (
            echo ❌ 取消同步
            exit /b 0
        )
    )
)

REM 执行同步
echo 📋 正在同步...
copy /y "%SOURCE%" "%TARGET%" >nul

if %errorlevel% equ 0 (
    echo ✅ 同步成功！
    echo.
    echo 文件信息:
    echo   源文件: %SOURCE%
    echo   目标文件: %TARGET%
    
    for %%A in ("%TARGET%") do (
        echo   文件大小: %%~zA bytes
    )
    
    REM 提示Git操作
    where git >nul 2>nul
    if %errorlevel% equ 0 (
        echo.
        echo 💡 建议执行:
        echo   git add %TARGET%
        echo   git commit -m "sync: 更新数据库架构文件"
    )
    
    echo.
) else (
    echo ❌ 同步失败
    exit /b 1
)
