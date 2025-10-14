@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ==============================================
REM ELonTalk 数据库重建脚本 (Windows)
REM 用途: 使用最新的schema文件重建数据库
REM 警告: 此操作会清空现有数据！
REM ==============================================

set DB_PATH=customer_service.db
set SCHEMA_FILE=database_schema.sql
set BACKUP_DIR=backups

echo ==============================================
echo ELonTalk 数据库重建工具
echo ==============================================
echo.

REM 检查schema文件
if not exist "%SCHEMA_FILE%" (
    echo ❌ 错误: 找不到 %SCHEMA_FILE% 文件
    exit /b 1
)

REM 检查是否安装了sqlite3
where sqlite3 >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 sqlite3 命令
    echo 请安装 SQLite: https://www.sqlite.org/download.html
    exit /b 1
)

REM 如果数据库存在，备份
if exist "%DB_PATH%" (
    echo ⚠️  检测到现有数据库文件
    set /p backup="是否要备份现有数据库? (y/n): "
    
    if /i "!backup!"=="y" (
        if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
        
        REM 生成带时间戳的备份文件名
        for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
        for /f "tokens=1-2 delims=/: " %%a in ('time /t') do (set mytime=%%a%%b)
        set BACKUP_FILE=%BACKUP_DIR%\customer_service_!mydate!_!mytime!.db
        
        echo 📦 正在备份数据库到: !BACKUP_FILE!
        copy "%DB_PATH%" "!BACKUP_FILE!" >nul
        echo ✅ 备份完成
        echo.
    )
    
    echo ⚠️  警告: 即将删除现有数据库并重建！
    echo 所有数据将丢失（除非已备份）
    set /p confirm="是否继续? (yes/no): "
    
    if not "!confirm!"=="yes" (
        echo ❌ 操作已取消
        exit /b 0
    )
    
    echo 🗑️  删除现有数据库...
    del "%DB_PATH%"
)

REM 创建新数据库
echo 🔨 正在创建新数据库...
sqlite3 "%DB_PATH%" < "%SCHEMA_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ 数据库重建成功！
    echo.
    
    REM 验证数据库
    echo 🔍 验证数据库表结构...
    sqlite3 "%DB_PATH%" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" > temp_count.txt
    set /p TABLE_COUNT=<temp_count.txt
    del temp_count.txt
    echo ✅ 已创建 !TABLE_COUNT! 个表
    
    REM 列出所有表
    echo.
    echo 📋 数据库表列表:
    sqlite3 "%DB_PATH%" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    
    echo.
    echo 🎉 数据库已准备就绪！
    echo 数据库位置: %DB_PATH%
    echo.
) else (
    echo.
    echo ❌ 数据库创建失败
    exit /b 1
)

endlocal
