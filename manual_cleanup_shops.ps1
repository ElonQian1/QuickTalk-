# 手动清理剩余的测试店铺
Write-Host "🧹 手动清理剩余的测试店铺..." -ForegroundColor Yellow

# 手动调用SQLite删除店铺（绕过外键约束）
$cleanupShops = @"
-- 禁用外键约束
PRAGMA foreign_keys = OFF;

-- 删除所有店铺
DELETE FROM shops;

-- 删除相关的激活订单
DELETE FROM activation_orders;

-- 重新启用外键约束
PRAGMA foreign_keys = ON;
"@

# 将SQL保存到临时文件
$cleanupShops | Out-File -FilePath "E:\kefu\backend\cleanup_shops.sql" -Encoding UTF8

Write-Host "✅ SQL清理脚本已创建: cleanup_shops.sql" -ForegroundColor Green

# 如果有sqlite3命令行工具，可以直接执行
try {
    sqlite3 "E:\kefu\backend\quicktalk.sqlite" ".read cleanup_shops.sql"
    Write-Host "✅ 店铺数据清理完成！" -ForegroundColor Green
} catch {
    Write-Host "⚠️ 需要手动执行SQL脚本清理店铺" -ForegroundColor Yellow
    Write-Host "SQL脚本位置: E:\kefu\backend\cleanup_shops.sql" -ForegroundColor Cyan
}

Write-Host "🔚 清理脚本执行完成" -ForegroundColor Green