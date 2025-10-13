#!/bin/bash

# ==============================================
# ELonTalk 部署前完整性验证
# ==============================================

echo "🔍 ELonTalk 部署前完整性验证"
echo "=============================================="
echo "⏰ 验证时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 验证结果统计
total_checks=0
passed_checks=0
failed_checks=0

check_item() {
    local item_name="$1"
    local check_command="$2"
    local expected_result="$3"
    
    ((total_checks++))
    
    echo -n "   $item_name ... "
    
    if eval "$check_command" >/dev/null 2>&1; then
        if [ -n "$expected_result" ]; then
            result=$(eval "$check_command" 2>/dev/null)
            if [[ "$result" == *"$expected_result"* ]]; then
                echo "✅ 通过"
                ((passed_checks++))
                return 0
            else
                echo "❌ 失败 (结果不符合预期)"
                ((failed_checks++))
                return 1
            fi
        else
            echo "✅ 通过"
            ((passed_checks++))
            return 0
        fi
    else
        echo "❌ 失败"
        ((failed_checks++))
        return 1
    fi
}

# 1. 核心文件检查
echo ""
echo "🗂️  核心文件检查"
echo "----------------------------------------"

check_item "可执行文件存在" "[ -f './customer-service-backend' ]"
check_item "可执行权限设置" "[ -x './customer-service-backend' ]"
check_item "前端静态文件" "[ -d './static' ] && [ -f './static/index.html' ]"
check_item "配置文件模板" "[ -f './.env.example' ]"
check_item "数据库架构文件" "[ -f './database_schema.sql' ]"

# 2. 可执行文件版本检查
echo ""
echo "🔧 可执行文件版本检查"
echo "----------------------------------------"

if [ -f "./customer-service-backend" ]; then
    # 检查文件大小（新版本应该更大）
    file_size=$(stat -c%s "./customer-service-backend" 2>/dev/null || echo "0")
    file_size_mb=$((file_size / 1024 / 1024))
    
    check_item "文件大小合理" "[ $file_size -gt 10485760 ]"  # > 10MB
    
    # 测试数据库迁移功能
    echo -n "   数据库迁移功能测试 ... "
    
    # 清理测试环境
    rm -f test_migration.db 2>/dev/null
    
    # 设置测试环境变量
    export DATABASE_URL="sqlite:./test_migration.db"
    export RUST_LOG="info"
    
    # 运行测试
    timeout 15s ./customer-service-backend > migration_test.log 2>&1 &
    test_pid=$!
    
    sleep 5
    
    # 检查测试结果
    if [ -f "test_migration.db" ]; then
        test_db_size=$(stat -c%s "test_migration.db" 2>/dev/null || echo "0")
        if [ "$test_db_size" -gt 1024 ]; then
            echo "✅ 通过 (数据库迁移正常)"
            ((passed_checks++))
            migration_works=true
        else
            echo "❌ 失败 (数据库迁移不工作)"
            ((failed_checks++))
            migration_works=false
        fi
    else
        echo "❌ 失败 (未创建数据库)"
        ((failed_checks++))
        migration_works=false
    fi
    
    ((total_checks++))
    
    # 停止测试进程
    if kill -0 $test_pid 2>/dev/null; then
        kill $test_pid 2>/dev/null || true
    fi
    
    # 清理测试文件
    rm -f test_migration.db migration_test.log 2>/dev/null
    
    # 检查是否包含跳过迁移的逻辑
    echo -n "   检查旧版本标识 ... "
    if grep -q "skipping migration" migration_test.log 2>/dev/null; then
        echo "❌ 警告 (发现跳过迁移逻辑)"
        ((failed_checks++))
        has_skip_logic=true
    else
        echo "✅ 通过 (无跳过迁移逻辑)"
        ((passed_checks++))
        has_skip_logic=false
    fi
    ((total_checks++))
    
else
    echo "   ❌ 跳过版本检查 (可执行文件不存在)"
    migration_works=false
    has_skip_logic=true
fi

# 3. 脚本工具检查
echo ""
echo "🛠️  管理脚本检查"
echo "----------------------------------------"

required_scripts=(
    "start.sh"
    "restart.sh" 
    "diagnose.sh"
    "fix-database.sh"
    "force-fix-database.sh"
    "verify-deployment.sh"
)

for script in "${required_scripts[@]}"; do
    check_item "$script" "[ -f './$script' ] && [ -x './$script' ]"
done

# 4. 环境依赖检查
echo ""
echo "🌍 环境依赖检查"  
echo "----------------------------------------"

check_item "sqlite3 可用" "command -v sqlite3"
check_item "curl 可用" "command -v curl"
check_item "netstat 或 ss 可用" "command -v netstat || command -v ss"

# 5. 网络端口检查
echo ""
echo "🌐 网络端口检查"
echo "----------------------------------------"

check_port_available() {
    local port=$1
    if command -v netstat >/dev/null 2>&1; then
        ! netstat -ln 2>/dev/null | grep -q ":$port "
    elif command -v ss >/dev/null 2>&1; then
        ! ss -ln 2>/dev/null | grep -q ":$port "
    else
        return 0  # 无法检查，假设可用
    fi
}

check_item "端口8080可用" "check_port_available 8080"
check_item "端口8443可用" "check_port_available 8443"

# 6. 生成验证报告
echo ""
echo "📊 验证报告"
echo "=============================================="

success_rate=$((passed_checks * 100 / total_checks))

echo "📋 统计信息:"
echo "   总检查项: $total_checks"
echo "   通过项: $passed_checks"
echo "   失败项: $failed_checks"
echo "   成功率: $success_rate%"

echo ""
if [ "$success_rate" -ge 90 ]; then
    echo "🎉 部署包质量: 优秀 ($success_rate%)"
    deployment_ready=true
elif [ "$success_rate" -ge 75 ]; then
    echo "✅ 部署包质量: 良好 ($success_rate%)"
    deployment_ready=true
elif [ "$success_rate" -ge 60 ]; then
    echo "⚠️  部署包质量: 一般 ($success_rate%)"
    deployment_ready=false
else
    echo "❌ 部署包质量: 不合格 ($success_rate%)"
    deployment_ready=false
fi

# 7. 关键问题检查
echo ""
echo "🚨 关键问题检查"
echo "----------------------------------------"

critical_issues=0

if [ "${migration_works:-false}" = false ]; then
    echo "❌ 严重问题: 数据库迁移不工作"
    echo "   影响: 将导致500错误"
    echo "   建议: 重新编译后端或使用 force-fix-database.sh"
    ((critical_issues++))
fi

if [ "${has_skip_logic:-false}" = true ]; then
    echo "⚠️  潜在问题: 发现跳过迁移逻辑"
    echo "   影响: 可能导致数据库初始化失败"
    echo "   建议: 更新到最新版本"
    ((critical_issues++))
fi

if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 严重问题: 缺少核心可执行文件"
    echo "   影响: 无法启动服务"
    echo "   建议: 重新编译并复制可执行文件"
    ((critical_issues++))
fi

# 8. 最终建议
echo ""
echo "💡 部署建议"
echo "=============================================="

if [ "$critical_issues" -eq 0 ] && [ "$deployment_ready" = true ]; then
    echo "🎉 部署包已就绪，可以安全部署！"
    echo ""
    echo "🚀 推荐部署步骤:"
    echo "   1. ./start.sh"
    echo "   2. ./verify-deployment.sh"
    echo "   3. ./diagnose.sh"
    
elif [ "$critical_issues" -eq 0 ]; then
    echo "⚠️  部署包基本可用，但建议先修复问题"
    echo ""
    echo "🔧 建议修复步骤:"
    echo "   1. 检查失败的验证项"
    echo "   2. 修复问题后重新验证"
    echo "   3. 谨慎部署并密切监控"
    
else
    echo "❌ 发现 $critical_issues 个严重问题，不建议部署"
    echo ""
    echo "🚑 紧急修复步骤:"
    
    if [ "${migration_works:-false}" = false ]; then
        echo "   1. 执行强制数据库修复: ./force-fix-database.sh"
    fi
    
    if [ "${has_skip_logic:-false}" = true ]; then
        echo "   2. 更新后端可执行文件: ./update-backend.sh"
    fi
    
    if [ ! -f "./customer-service-backend" ]; then
        echo "   3. 重新编译并复制后端可执行文件"
    fi
    
    echo "   4. 重新运行此验证: ./pre-deploy-check.sh"
fi

echo ""
echo "📋 问题预防措施:"
echo "   • 每次部署前运行此验证脚本"
echo "   • 保持可执行文件为最新编译版本"
echo "   • 定期检查数据库迁移功能"
echo "   • 维护完整的管理脚本工具集"

echo ""
echo "🔍 部署前验证完成!"