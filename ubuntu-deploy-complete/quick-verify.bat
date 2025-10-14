@echo off
chcp 65001 >nul

REM 快速验证数据库schema文件
echo 🔍 验证 database_schema.sql 文件...
echo.

REM 创建测试数据库
echo 📝 创建测试数据库...
sqlite3 _test_temp.db < database_schema.sql 2>nul

if %errorlevel% neq 0 (
    echo ❌ Schema文件有语法错误
    exit /b 1
)

echo ✅ Schema文件语法正确
echo.

REM 检查表
echo 📋 已创建的表:
sqlite3 _test_temp.db "SELECT '  ✓ ' || name FROM sqlite_master WHERE type='table' ORDER BY name;"
echo.

REM 统计
for /f %%i in ('sqlite3 _test_temp.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"') do set TABLE_COUNT=%%i
for /f %%i in ('sqlite3 _test_temp.db "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%%';"') do set INDEX_COUNT=%%i
for /f %%i in ('sqlite3 _test_temp.db "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger';"') do set TRIGGER_COUNT=%%i

echo 📊 统计:
echo   • 表: %TABLE_COUNT%
echo   • 索引: %INDEX_COUNT%
echo   • 触发器: %TRIGGER_COUNT%
echo.

REM 验证关键表
echo 🔑 验证关键表和字段...
sqlite3 _test_temp.db "SELECT CASE WHEN EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='shop_staffs') THEN '  ✅ shop_staffs 表存在' ELSE '  ❌ shop_staffs 表缺失' END;"
sqlite3 _test_temp.db "SELECT CASE WHEN EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='unread_counts') THEN '  ✅ unread_counts 表存在' ELSE '  ❌ unread_counts 表缺失' END;"
sqlite3 _test_temp.db "SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('customers') WHERE name='last_active_at') THEN '  ✅ customers.last_active_at 字段存在' ELSE '  ❌ customers.last_active_at 字段缺失' END;"

echo.
echo ✅ 验证完成！

REM 清理
del _test_temp.db 2>nul
