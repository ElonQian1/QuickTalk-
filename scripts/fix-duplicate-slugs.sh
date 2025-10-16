#!/bin/bash

# 数据库修复脚本：清理重复slug并添加唯一约束
# 修复时间：2025-10-16
# 问题：shops表中存在重复的slug，违反了业务逻辑

echo "🔧 开始修复数据库中的重复slug问题..."

DB_FILE="customer_service.db"

if [ ! -f "$DB_FILE" ]; then
    echo "❌ 错误：数据库文件 $DB_FILE 不存在"
    exit 1
fi

echo "📊 检查重复slug..."
DUPLICATES=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM (SELECT slug FROM shops GROUP BY slug HAVING COUNT(*) > 1);")

if [ "$DUPLICATES" -eq 0 ]; then
    echo "✅ 没有发现重复的slug"
else
    echo "⚠️  发现 $DUPLICATES 个重复的slug，开始清理..."
    
    # 显示将要删除的记录
    echo "📋 将要删除的重复记录："
    sqlite3 "$DB_FILE" "
    SELECT id, shop_name, slug, created_at 
    FROM (
        SELECT id, shop_name, slug, created_at,
               ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as row_num
        FROM shops 
        WHERE slug IN (SELECT slug FROM shops GROUP BY slug HAVING COUNT(*) > 1)
    ) WHERE row_num > 1;"
    
    # 删除重复记录（保留最早创建的）
    echo "🗑️  删除重复记录..."
    sqlite3 "$DB_FILE" "
    DELETE FROM shops 
    WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as row_num
            FROM shops 
            WHERE slug IN (SELECT slug FROM shops GROUP BY slug HAVING COUNT(*) > 1)
        ) WHERE row_num > 1
    );"
    
    echo "✅ 重复记录清理完成"
fi

echo "🔒 添加slug唯一约束..."

# 检查是否已经有唯一索引
INDEX_EXISTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_shops_slug_unique';")

if [ "$INDEX_EXISTS" -eq 0 ]; then
    sqlite3 "$DB_FILE" "CREATE UNIQUE INDEX idx_shops_slug_unique ON shops(slug);"
    echo "✅ 唯一约束添加成功"
else
    echo "ℹ️  唯一约束已存在，跳过"
fi

# 验证修复结果
echo "📋 修复结果验证："
TOTAL_SHOPS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM shops;")
UNIQUE_SLUGS=$(sqlite3 "$DB_FILE" "SELECT COUNT(DISTINCT slug) FROM shops;")

echo "  - 总店铺数量: $TOTAL_SHOPS"
echo "  - 唯一slug数量: $UNIQUE_SLUGS"

if [ "$TOTAL_SHOPS" -eq "$UNIQUE_SLUGS" ]; then
    echo "✅ 修复成功：所有店铺都有唯一的slug"
else
    echo "❌ 修复失败：仍有重复的slug"
    exit 1
fi

echo "🎉 数据库修复完成！"