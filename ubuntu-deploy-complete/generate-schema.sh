#!/bin/bash

# ==============================================
# 智能Schema生成工具
# 从多种数据源生成完整的数据库架构
# ==============================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}==============================================\n"
echo -e "智能数据库Schema生成器\n"
echo -e "==============================================${NC}\n"

# 配置
SOURCE_SCHEMA="backend/src/schema.sql"
OUTPUT_FILE="ubuntu-deploy-complete/database_schema.sql"
TEMP_DB="temp_schema_gen.db"

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}🔍 检查依赖...${NC}"
    
    if ! command -v sqlite3 &> /dev/null; then
        echo -e "${RED}❌ 错误: 需要安装 sqlite3${NC}"
        exit 1
    fi
    
    if ! command -v cargo &> /dev/null; then
        echo -e "${YELLOW}⚠️  警告: 未找到 cargo，无法从Rust代码生成${NC}"
    fi
    
    echo -e "${GREEN}✅ 依赖检查完成${NC}\n"
}

# 方法1: 从现有schema.sql生成
generate_from_existing() {
    echo -e "${BLUE}📋 方法1: 从现有schema文件生成...${NC}"
    
    if [ ! -f "$SOURCE_SCHEMA" ]; then
        echo -e "${RED}❌ 找不到源schema文件: $SOURCE_SCHEMA${NC}"
        return 1
    fi
    
    # 创建临时数据库并应用schema
    rm -f "$TEMP_DB"
    sqlite3 "$TEMP_DB" < "$SOURCE_SCHEMA" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Schema应用成功${NC}"
        return 0
    else
        echo -e "${RED}❌ Schema应用失败${NC}"
        return 1
    fi
}

# 方法2: 从运行中的数据库导出
generate_from_running_db() {
    echo -e "${BLUE}🗄️  方法2: 从运行中的数据库导出...${NC}"
    
    local db_path="backend/customer_service.db"
    if [ -f "$db_path" ]; then
        echo -e "${GREEN}✅ 发现运行中的数据库: $db_path${NC}"
        
        # 导出完整schema
        sqlite3 "$db_path" ".schema" > temp_exported.sql 2>/dev/null
        
        if [ -s temp_exported.sql ]; then
            mv temp_exported.sql "$TEMP_DB.schema"
            sqlite3 "$TEMP_DB" < "$TEMP_DB.schema"
            return 0
        fi
    fi
    
    echo -e "${YELLOW}⚠️  未找到可用的运行数据库${NC}"
    return 1
}

# 方法3: 从Rust代码生成（如果有cargo）
generate_from_rust() {
    echo -e "${BLUE}🦀 方法3: 从Rust代码生成...${NC}"
    
    if ! command -v cargo &> /dev/null; then
        echo -e "${YELLOW}⚠️  跳过: 未找到cargo${NC}"
        return 1
    fi
    
    # 尝试编译并运行migration
    cd backend 2>/dev/null || return 1
    
    # 创建临时的schema生成器
    cat > src/bin/generate_schema.rs << 'EOF'
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 读取嵌入的schema
    let schema = include_str!("../schema.sql");
    
    // 创建临时数据库并应用schema  
    let temp_db = "../temp_schema_from_rust.db";
    std::process::Command::new("sqlite3")
        .arg(temp_db)
        .stdin(std::process::Stdio::piped())
        .spawn()?
        .stdin
        .as_mut()
        .unwrap()
        .write_all(schema.as_bytes())?;
        
    println!("✅ Schema from Rust generated: {}", temp_db);
    Ok(())
}
EOF
    
    if cargo run --bin generate_schema --quiet 2>/dev/null; then
        cd ..
        if [ -f "temp_schema_from_rust.db" ]; then
            mv "temp_schema_from_rust.db" "$TEMP_DB"
            rm -f backend/src/bin/generate_schema.rs 2>/dev/null
            return 0
        fi
    fi
    
    cd ..
    rm -f backend/src/bin/generate_schema.rs 2>/dev/null
    echo -e "${YELLOW}⚠️  Rust代码生成失败${NC}"
    return 1
}

# 导出完整的标准化schema
export_complete_schema() {
    echo -e "${BLUE}📤 导出完整schema...${NC}"
    
    if [ ! -f "$TEMP_DB" ]; then
        echo -e "${RED}❌ 没有可用的临时数据库${NC}"
        return 1
    fi
    
    # 创建完整的schema文件
    cat > "$OUTPUT_FILE" << 'EOF'
-- ==============================================
-- ELonTalk 客服系统 - 完整数据库架构
-- 自动生成时间: $(date)
-- 生成方式: 智能Schema生成器
-- ==============================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

EOF
    
    # 导出所有表结构
    echo -e "${BLUE}📋 导出表结构...${NC}"
    sqlite3 "$TEMP_DB" "
        SELECT sql || ';'
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
    " >> "$OUTPUT_FILE"
    
    echo -e "\n-- 索引\n" >> "$OUTPUT_FILE"
    
    # 导出所有索引
    sqlite3 "$TEMP_DB" "
        SELECT sql || ';'
        FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
    " >> "$OUTPUT_FILE"
    
    echo -e "\n-- 触发器\n" >> "$OUTPUT_FILE"
    
    # 导出所有触发器
    sqlite3 "$TEMP_DB" "
        SELECT sql || ';'
        FROM sqlite_master 
        WHERE type='trigger'
        ORDER BY name;
    " >> "$OUTPUT_FILE"
    
    # 添加初始数据（如果需要）
    if sqlite3 "$TEMP_DB" "SELECT COUNT(*) FROM users;" 2>/dev/null | grep -q "0"; then
        echo -e "\n-- 初始数据\n" >> "$OUTPUT_FILE"
        echo "INSERT OR IGNORE INTO users (id, username, password_hash, email, role) VALUES" >> "$OUTPUT_FILE"
        echo "(1, 'admin', '\$2b\$12\$dummy.hash', 'admin@example.com', 'admin');" >> "$OUTPUT_FILE"
    fi
    
    # 美化格式
    sed -i 's/CREATE TABLE/\nCREATE TABLE/g' "$OUTPUT_FILE" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Schema导出完成: $OUTPUT_FILE${NC}"
}

# 验证生成的schema
validate_schema() {
    echo -e "${BLUE}🔍 验证生成的schema...${NC}"
    
    if [ ! -f "$OUTPUT_FILE" ]; then
        echo -e "${RED}❌ 输出文件不存在${NC}"
        return 1
    fi
    
    # 测试schema是否有效
    local test_db="test_validation.db"
    rm -f "$test_db"
    
    if sqlite3 "$test_db" < "$OUTPUT_FILE" 2>/dev/null; then
        local table_count=$(sqlite3 "$test_db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        echo -e "${GREEN}✅ Schema验证通过，包含 $table_count 个表${NC}"
        rm -f "$test_db"
        return 0
    else
        echo -e "${RED}❌ Schema验证失败${NC}"
        rm -f "$test_db"
        return 1
    fi
}

# 显示统计信息
show_statistics() {
    echo -e "\n${BLUE}📊 生成统计:${NC}"
    
    if [ -f "$OUTPUT_FILE" ]; then
        local tables=$(grep -c "CREATE TABLE" "$OUTPUT_FILE" 2>/dev/null || echo "0")
        local indexes=$(grep -c "CREATE INDEX" "$OUTPUT_FILE" 2>/dev/null || echo "0")  
        local triggers=$(grep -c "CREATE TRIGGER" "$OUTPUT_FILE" 2>/dev/null || echo "0")
        local lines=$(wc -l < "$OUTPUT_FILE" 2>/dev/null || echo "0")
        local size=$(du -h "$OUTPUT_FILE" 2>/dev/null | cut -f1 || echo "0B")
        
        echo -e "  📋 表数量: ${GREEN}$tables${NC}"
        echo -e "  🔍 索引数量: ${GREEN}$indexes${NC}"
        echo -e "  ⚡ 触发器数量: ${GREEN}$triggers${NC}"
        echo -e "  📄 文件行数: ${GREEN}$lines${NC}"
        echo -e "  💾 文件大小: ${GREEN}$size${NC}"
    fi
}

# 清理临时文件
cleanup() {
    rm -f "$TEMP_DB" "$TEMP_DB.schema" "temp_exported.sql" "temp_schema_from_rust.db" 2>/dev/null
}

# 主流程
main() {
    check_dependencies
    
    echo -e "${BLUE}🚀 开始智能schema生成...${NC}\n"
    
    # 尝试不同的生成方法
    if generate_from_existing; then
        echo -e "${GREEN}✅ 使用现有schema文件生成${NC}\n"
    elif generate_from_running_db; then
        echo -e "${GREEN}✅ 从运行数据库导出${NC}\n"
    elif generate_from_rust; then
        echo -e "${GREEN}✅ 从Rust代码生成${NC}\n"
    else
        echo -e "${RED}❌ 所有生成方法都失败了${NC}"
        cleanup
        exit 1
    fi
    
    # 导出并验证
    if export_complete_schema && validate_schema; then
        show_statistics
        echo -e "\n${GREEN}🎉 Schema生成成功！${NC}"
        echo -e "${BLUE}输出文件: $OUTPUT_FILE${NC}\n"
    else
        echo -e "${RED}❌ Schema生成失败${NC}"
        cleanup
        exit 1
    fi
    
    cleanup
}

# 捕获中断信号并清理
trap cleanup EXIT INT TERM

# 运行主流程
main "$@"