#!/bin/bash
# 数据库迁移管理脚本
# 版本: 2.0 - 智能迁移系统

set -e

# 配置
DEPLOY_DIR="/root/ubuntu-deploy-ready"
DB_FILE="${DEPLOY_DIR}/customer_service.db"
MIGRATION_DIR="${DEPLOY_DIR}/migrations"
VERSION_FILE="${DEPLOY_DIR}/.db_version"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[迁移]${NC} $1"; }
print_success() { echo -e "${GREEN}[成功]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
print_error() { echo -e "${RED}[错误]${NC} $1"; }

# 获取当前数据库版本
get_db_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE"
    else
        echo "0"
    fi
}

# 设置数据库版本
set_db_version() {
    echo "$1" > "$VERSION_FILE"
    print_success "数据库版本更新为: $1"
}

# 备份数据库
backup_database() {
    local backup_file="${DB_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$DB_FILE" ]; then
        cp "$DB_FILE" "$backup_file"
        print_success "数据库已备份: $(basename $backup_file)"
        return 0
    else
        print_warning "数据库文件不存在，跳过备份"
        return 1
    fi
}

# 创建迁移目录结构
init_migrations() {
    mkdir -p "$MIGRATION_DIR"
    
    # 创建版本1的迁移文件（修复字段不匹配）
    cat > "$MIGRATION_DIR/001_fix_customer_fields.sql" << 'EOF'
-- 迁移版本: 001
-- 描述: 修复customers表字段不匹配问题
-- 日期: 2025-10-14

-- 检查并添加 last_active_at 字段
ALTER TABLE customers ADD COLUMN last_active_at TIMESTAMP DEFAULT NULL;

-- 同步现有数据
UPDATE customers SET last_active_at = last_seen WHERE last_seen IS NOT NULL;

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_customers_last_active_at ON customers(last_active_at);
CREATE INDEX IF NOT EXISTS idx_customers_shop_active ON customers(shop_id, last_active_at);
EOF

    # 创建版本2的迁移文件（未来扩展）
    cat > "$MIGRATION_DIR/002_add_customer_metadata.sql" << 'EOF'
-- 迁移版本: 002
-- 描述: 增强客户元数据支持
-- 日期: 2025-10-14

-- 添加客户标签字段
ALTER TABLE customers ADD COLUMN tags TEXT DEFAULT NULL;

-- 添加客户来源字段
ALTER TABLE customers ADD COLUMN source VARCHAR(50) DEFAULT 'web';

-- 添加客户优先级字段
ALTER TABLE customers ADD COLUMN priority INTEGER DEFAULT 0;
EOF

    print_success "迁移文件初始化完成"
}

# 执行单个迁移
run_migration() {
    local migration_file="$1"
    local version="$2"
    
    print_info "执行迁移: $(basename $migration_file)"
    
    if sqlite3 "$DB_FILE" < "$migration_file"; then
        set_db_version "$version"
        print_success "迁移 $version 执行成功"
        return 0
    else
        print_error "迁移 $version 执行失败"
        return 1
    fi
}

# 主迁移函数
migrate_database() {
    local current_version=$(get_db_version)
    local target_version=2  # 当前最新版本
    
    print_info "当前数据库版本: $current_version"
    print_info "目标版本: $target_version"
    
    if [ "$current_version" -ge "$target_version" ]; then
        print_success "数据库已是最新版本"
        return 0
    fi
    
    # 备份数据库
    backup_database
    
    # 执行迁移
    for version in $(seq $((current_version + 1)) $target_version); do
        local migration_file="$MIGRATION_DIR/$(printf "%03d" $version)_*.sql"
        
        if ls $migration_file 1> /dev/null 2>&1; then
            run_migration $migration_file $version
        else
            print_warning "迁移文件不存在: 版本 $version"
        fi
    done
    
    print_success "数据库迁移完成!"
}

# 验证数据库结构
validate_schema() {
    print_info "验证数据库结构..."
    
    # 检查关键字段
    local missing_fields=()
    
    # 检查 customers.last_active_at
    if ! sqlite3 "$DB_FILE" "PRAGMA table_info(customers);" | grep -q "last_active_at"; then
        missing_fields+=("customers.last_active_at")
    fi
    
    if [ ${#missing_fields[@]} -eq 0 ]; then
        print_success "数据库结构验证通过"
        return 0
    else
        print_error "发现缺失字段: ${missing_fields[*]}"
        return 1
    fi
}

# 显示数据库信息
show_info() {
    print_info "数据库信息:"
    echo "  路径: $DB_FILE"
    echo "  版本: $(get_db_version)"
    echo "  大小: $(ls -lh "$DB_FILE" 2>/dev/null | awk '{print $5}' || echo '不存在')"
    
    if [ -f "$DB_FILE" ]; then
        echo "  表数量: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")"
    fi
}

# 主函数
case "${1:-migrate}" in
    "migrate")
        init_migrations
        migrate_database
        validate_schema
        ;;
    "init")
        init_migrations
        print_success "迁移系统初始化完成"
        ;;
    "validate")
        validate_schema
        ;;
    "backup")
        backup_database
        ;;
    "info")
        show_info
        ;;
    "force-migrate")
        print_warning "强制迁移模式"
        backup_database
        init_migrations
        migrate_database
        ;;
    *)
        echo "数据库迁移管理工具"
        echo "用法: $0 [migrate|init|validate|backup|info|force-migrate]"
        echo ""
        echo "  migrate       - 执行数据库迁移 (默认)"
        echo "  init          - 初始化迁移文件"
        echo "  validate      - 验证数据库结构"
        echo "  backup        - 备份数据库"
        echo "  info          - 显示数据库信息"
        echo "  force-migrate - 强制重新迁移"
        ;;
esac