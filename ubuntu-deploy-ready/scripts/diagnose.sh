#!/bin/bash#!/bin/bash

# 系统诊断脚本 - 全面检查部署环境# ELonTalk 客服系统 - 问题诊断脚本

# 版本: 2.0# 版本: 1.0

# 更新时间: 2025年10月14日

set -e

set -e

# 颜色输出

RED='\033[0;31m'# 彩色输出

GREEN='\033[0;32m'RED='\033[0;31m'

YELLOW='\033[1;33m'GREEN='\033[0;32m'

BLUE='\033[0;34m'YELLOW='\033[1;33m'

CYAN='\033[0;36m'BLUE='\033[0;34m'

NC='\033[0m'NC='\033[0m' # No Color



DEPLOY_DIR="/root/ubuntu-deploy-ready"# 配置变量

DEPLOY_DIR="/root/ubuntu-deploy-ready"

print_header() { echo -e "${CYAN}$1${NC}"; }LOG_FILE="${DEPLOY_DIR}/logs/diagnostic.log"

print_check() { echo -e "${BLUE}[检查]${NC} $1"; }

print_ok() { echo -e "${GREEN}[正常]${NC} $1"; }# 函数: 打印彩色信息

print_warn() { echo -e "${YELLOW}[警告]${NC} $1"; }print_info() {

print_fail() { echo -e "${RED}[失败]${NC} $1"; }    echo -e "${BLUE}[INFO]${NC} $1"

}

clear

print_header "========================================="print_success() {

print_header "  ELonTalk 系统诊断工具"    echo -e "${GREEN}[SUCCESS]${NC} $1"

print_header "========================================="}

echo ""

print_warning() {

# 1. 系统信息    echo -e "${YELLOW}[WARNING]${NC} $1"

print_header "📋 系统信息"}

echo "操作系统: $(uname -a)"

echo "当前用户: $(whoami)"print_error() {

echo "当前目录: $(pwd)"    echo -e "${RED}[ERROR]${NC} $1"

echo "部署目录: $DEPLOY_DIR"}

echo ""

# 函数: 检查系统状态

# 2. 检查部署目录check_system_status() {

print_header "📁 部署目录检查"    print_info "检查系统状态..."

if [ -d "$DEPLOY_DIR" ]; then    

    print_ok "部署目录存在"    echo "当前用户: $(whoami)"

    cd "$DEPLOY_DIR"    echo "当前目录: $(pwd)"

        echo "系统时间: $(date)"

    # 检查关键文件    echo "系统负载: $(uptime)"

    files=(    echo ""

        "customer-service-backend"}

        ".env"

        "scripts/deploy-https.sh"# 函数: 检查部署目录

        "scripts/quick-fix.sh"check_deploy_directory() {

        "static/index.html"    print_info "检查部署目录..."

    )    

        if [ -d "$DEPLOY_DIR" ]; then

    for file in "${files[@]}"; do        print_success "部署目录存在: $DEPLOY_DIR"

        if [ -e "$file" ]; then        

            print_ok "文件存在: $file"        echo "目录权限:"

        else        ls -la "$DEPLOY_DIR" | head -10

            print_fail "文件缺失: $file"        echo ""

        fi        

    done        echo "目录大小:"

else        du -sh "$DEPLOY_DIR"

    print_fail "部署目录不存在: $DEPLOY_DIR"        echo ""

    exit 1        

fi        # 检查关键文件

echo ""        local files=("customer-service-backend" ".env" "static/index.html")

        for file in "${files[@]}"; do

# 3. 权限检查            local filepath="${DEPLOY_DIR}/${file}"

print_header "🔒 权限检查"            if [ -e "$filepath" ]; then

print_check "检查可执行文件权限..."                print_success "✅ $file 存在"

                ls -la "$filepath"

if [ -x "customer-service-backend" ]; then            else

    print_ok "应用程序可执行"                print_error "❌ $file 不存在"

else            fi

    print_fail "应用程序不可执行"        done

fi        

    else

if [ -d "scripts" ]; then        print_error "部署目录不存在: $DEPLOY_DIR"

    for script in scripts/*.sh; do        return 1

        if [ -x "$script" ]; then    fi

            print_ok "脚本可执行: $(basename $script)"}

        else

            print_warn "脚本不可执行: $(basename $script)"# 函数: 检查数据库

        ficheck_database() {

    done    print_info "检查数据库..."

fi    

echo ""    local db_file="${DEPLOY_DIR}/customer_service.db"

    

# 4. 网络检查    if [ -f "$db_file" ]; then

print_header "🌐 网络检查"        print_success "数据库文件存在"

        echo "数据库文件信息:"

# 检查公网IP        ls -la "$db_file"

print_check "获取公网IP..."        echo "文件大小: $(stat -c%s "$db_file") 字节"

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "获取失败")        

echo "公网IP: $PUBLIC_IP"        # 检查是否可以访问数据库

        if command -v sqlite3 >/dev/null 2>&1; then

# 检查DuckDNS解析            print_info "测试数据库连接..."

print_check "检查DuckDNS解析..."            if sqlite3 "$db_file" ".tables" >/dev/null 2>&1; then

RESOLVED_IP=$(nslookup elontalk.duckdns.org | grep -A1 "Name:" | tail -1 | awk '{print $2}' 2>/dev/null || echo "解析失败")                print_success "数据库连接正常"

echo "域名解析: elontalk.duckdns.org -> $RESOLVED_IP"                echo "数据库表:"

                sqlite3 "$db_file" ".tables"

if [ "$PUBLIC_IP" = "$RESOLVED_IP" ]; then            else

    print_ok "域名解析正确"                print_error "数据库连接失败"

else            fi

    print_warn "域名解析不匹配"        else

fi            print_warning "sqlite3 命令不可用，跳过数据库测试"

echo ""        fi

        

# 5. 端口检查    else

print_header "🔌 端口检查"        print_warning "数据库文件不存在，将在启动时创建"

ports=("8080" "8443" "80" "443")    fi

    echo ""

for port in "${ports[@]}"; do}

    if netstat -tlpn 2>/dev/null | grep ":$port " >/dev/null; then

        process=$(netstat -tlpn 2>/dev/null | grep ":$port " | awk '{print $7}' | head -1)# 函数: 检查证书

        print_ok "端口 $port 被占用: $process"check_certificates() {

    else    print_info "检查SSL证书..."

        print_warn "端口 $port 未监听"    

    fi    local cert_file="${DEPLOY_DIR}/certs/server.crt"

done    local key_file="${DEPLOY_DIR}/certs/server.key"

echo ""    

    if [ -f "$cert_file" ] && [ -f "$key_file" ]; then

# 6. 防火墙检查        print_success "证书文件存在"

print_header "🛡️  防火墙检查"        

if command -v ufw >/dev/null 2>&1; then        echo "证书文件权限:"

    ufw_status=$(ufw status 2>/dev/null | head -1)        ls -la "$cert_file" "$key_file"

    echo "UFW状态: $ufw_status"        

            if command -v openssl >/dev/null 2>&1; then

    if ufw status 2>/dev/null | grep -E "80|8080|8443" >/dev/null; then            print_info "验证证书..."

        print_ok "防火墙规则已配置"            

    else            # 检查证书有效性

        print_warn "防火墙可能阻止连接"            if openssl x509 -in "$cert_file" -noout -checkend 0 >/dev/null 2>&1; then

    fi                print_success "证书有效"

else            else

    print_warn "UFW未安装"                print_error "证书无效或已过期"

fi            fi

echo ""            

            # 显示证书信息

# 7. SSL证书检查            echo "证书详情:"

print_header "🔐 SSL证书检查"            openssl x509 -in "$cert_file" -text -noout | grep -E "Subject:|Issuer:|Not After:" | head -3

if [ -f "certs/server.crt" ] && [ -f "certs/server.key" ]; then            

    print_ok "证书文件存在"        else

                print_warning "openssl 命令不可用，跳过证书验证"

    # 检查证书有效期        fi

    if openssl x509 -in "certs/server.crt" -noout -dates 2>/dev/null; then        

        print_ok "证书有效"    else

    else        print_warning "证书文件不存在"

        print_warn "证书可能损坏"        echo "缺失文件:"

    fi        [ ! -f "$cert_file" ] && echo "  - $cert_file"

else        [ ! -f "$key_file" ] && echo "  - $key_file"

    print_fail "证书文件缺失"    fi

fi    echo ""

echo ""}



# 8. 数据库检查# 函数: 检查网络和端口

print_header "🗄️  数据库检查"check_network() {

if [ -f "customer_service.db" ]; then    print_info "检查网络和端口..."

    db_size=$(ls -lh customer_service.db | awk '{print $5}')    

    print_ok "数据库文件存在 (大小: $db_size)"    echo "网络接口:"

        ip addr show | grep -E "inet [0-9]" | head -5

    # 检查数据库权限    echo ""

    if [ -r "customer_service.db" ] && [ -w "customer_service.db" ]; then    

        print_ok "数据库权限正常"    echo "监听端口:"

    else    netstat -tulpn 2>/dev/null | grep -E ":80[80|43]" || echo "  没有发现8080或8443端口监听"

        print_warn "数据库权限可能有问题"    echo ""

    fi    

        # 检查防火墙

    # 测试SQLite连接    print_info "检查防火墙状态..."

    if command -v sqlite3 >/dev/null 2>&1; then    if command -v ufw >/dev/null 2>&1; then

        if sqlite3 "customer_service.db" "SELECT 1;" >/dev/null 2>&1; then        ufw status

            print_ok "数据库连接测试通过"    else

        else        print_warning "ufw 不可用"

            print_warn "数据库连接测试失败"    fi

        fi    echo ""

    else}

        print_warn "sqlite3未安装，无法测试"

    fi# 函数: 检查进程

elsecheck_processes() {

    print_warn "数据库文件不存在"    print_info "检查相关进程..."

fi    

echo ""    echo "客服系统进程:"

    ps aux | grep -E "customer-service|elontalk" | grep -v grep || echo "  没有发现相关进程"

# 9. 服务状态检查    echo ""

print_header "⚙️  服务状态检查"    

if pgrep -f customer-service-backend >/dev/null; then    echo "端口占用情况:"

    pid=$(pgrep -f customer-service-backend)    lsof -i :8080 2>/dev/null || echo "  端口8080未被占用"

    print_ok "服务正在运行 (PID: $pid)"    lsof -i :8443 2>/dev/null || echo "  端口8443未被占用"

        echo ""

    # 检查启动时间}

    if ps -p $pid -o etime= >/dev/null 2>&1; then

        uptime=$(ps -p $pid -o etime= | tr -d ' ')# 函数: 检查环境变量

        print_ok "运行时间: $uptime"check_environment() {

    fi    print_info "检查环境变量..."

else    

    print_warn "服务未运行"    local env_file="${DEPLOY_DIR}/.env"

fi    

    if [ -f "$env_file" ]; then

# 检查最新日志        print_success "环境配置文件存在"

if [ -f "logs/service.log" ]; then        echo "关键配置:"

    log_size=$(ls -lh logs/service.log | awk '{print $5}')        grep -E "DATABASE_URL|TLS_MODE|SERVER_PORT|TLS_PORT" "$env_file" || echo "  配置项未找到"

    print_ok "日志文件存在 (大小: $log_size)"    else

            print_error "环境配置文件不存在: $env_file"

    echo ""    fi

    print_check "最新日志 (最后10行):"    echo ""

    echo "---"}

    tail -10 "logs/service.log" 2>/dev/null || print_warn "无法读取日志"

    echo "---"# 函数: 尝试启动测试

elsetest_startup() {

    print_warn "日志文件不存在"    print_info "测试应用启动..."

fi    

echo ""    cd "$DEPLOY_DIR"

    

# 10. 环境变量检查    if [ -x "customer-service-backend" ]; then

print_header "🔧 环境变量检查"        print_info "尝试启动应用 (5秒测试)..."

if [ -f ".env" ]; then        

    print_ok ".env文件存在"        # 设置环境变量

            export DATABASE_URL="sqlite:customer_service.db"

    # 检查关键变量        export RUST_LOG=debug

    key_vars=("DATABASE_URL" "TLS_MODE" "HTTPS_ENABLED" "JWT_SECRET")        export TLS_MODE=http  # 先测试HTTP模式

    for var in "${key_vars[@]}"; do        

        if grep -q "^$var=" ".env" 2>/dev/null; then        # 启动应用并限制时间

            print_ok "配置存在: $var"        timeout 5s ./customer-service-backend 2>&1 | tee "${LOG_FILE}" || true

        else        

            print_warn "配置缺失: $var"        print_info "启动测试完成，检查日志:"

        fi        if [ -f "${LOG_FILE}" ]; then

    done            echo "最近的日志输出:"

else            tail -10 "${LOG_FILE}"

    print_fail ".env文件不存在"        fi

fi        

echo ""    else

        print_error "可执行文件不存在或没有执行权限"

# 11. 连接测试        ls -la "customer-service-backend" 2>/dev/null || echo "文件不存在"

print_header "🔗 连接测试"    fi

print_check "测试本地HTTP连接..."    echo ""

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080" 2>/dev/null | grep -q "200\|404"; then}

    print_ok "HTTP连接正常"

else# 函数: 生成修复建议

    print_warn "HTTP连接失败"generate_suggestions() {

fi    print_info "生成修复建议..."

    

print_check "测试本地HTTPS连接..."    echo ""

if curl -k -s -o /dev/null -w "%{http_code}" "https://localhost:8443" 2>/dev/null | grep -q "200\|404"; then    echo "========================================="

    print_ok "HTTPS连接正常"    echo "  修复建议"

else    echo "========================================="

    print_warn "HTTPS连接失败"    echo ""

fi    

echo ""    # 检查常见问题并给出建议

    if [ ! -f "${DEPLOY_DIR}/customer_service.db" ]; then

# 12. 总结和建议        echo "🔧 数据库问题:"

print_header "📊 诊断总结"        echo "   运行: ./scripts/fix-database.sh"

echo ""        echo ""

print_check "如果发现问题，请尝试以下解决方案："    fi

echo ""    

echo "1. 权限问题:"    if [ ! -f "${DEPLOY_DIR}/certs/server.crt" ]; then

echo "   chmod +x customer-service-backend"        echo "🔐 证书问题:"

echo "   chmod +x scripts/*.sh"        echo "   运行: ./scripts/cert-manager.sh auto"

echo ""        echo "   或者: ./scripts/cert-manager.sh selfsigned"

echo "2. 端口被占用:"        echo ""

echo "   ./scripts/quick-fix.sh"    fi

echo ""    

echo "3. 证书问题:"    if [ ! -x "${DEPLOY_DIR}/customer-service-backend" ]; then

echo "   ./scripts/deploy-https.sh cert-only"        echo "📋 权限问题:"

echo ""        echo "   运行: chmod +x customer-service-backend"

echo "4. 完整重新部署:"        echo ""

echo "   ./scripts/deploy-https.sh"    fi

echo ""    

echo "5. 查看实时日志:"    echo "🚀 推荐启动步骤:"

echo "   tail -f logs/service.log"    echo "   1. cd /root/ubuntu-deploy-ready"

echo ""    echo "   2. ./scripts/fix-database.sh"

    echo "   3. ./scripts/cert-manager.sh selfsigned  # 快速测试"

print_header "========================================="    echo "   4. chmod +x customer-service-backend"

print_header "  诊断完成"    echo "   5. TLS_MODE=http ./customer-service-backend  # 先测试HTTP"

print_header "========================================="    echo ""
    
    echo "🌐 访问测试:"
    echo "   HTTP:  http://43.139.82.12:8080"
    echo "   HTTPS: https://43.139.82.12:8443"
    echo ""
    
    echo "📝 查看详细日志:"
    echo "   RUST_LOG=debug ./customer-service-backend"
    echo ""
    
    echo "========================================="
}

# 主函数
main() {
    echo "ELonTalk 客服系统 - 问题诊断脚本"
    echo "================================="
    echo ""
    
    # 确保日志目录存在
    mkdir -p "${DEPLOY_DIR}/logs"
    
    # 运行所有检查
    check_system_status
    check_deploy_directory
    check_database
    check_certificates
    check_network
    check_processes
    check_environment
    test_startup
    generate_suggestions
    
    print_success "诊断完成！详细日志已保存到: ${LOG_FILE}"
}

# 运行主函数
main "$@"