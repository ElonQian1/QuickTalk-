#!/bin/bash

# QuickTalk 全栈开发启动脚本 (跨平台版本)
# 使用方法: ./dev.sh [setup|dev|build|clean]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

function print_colored() {
    echo -e "${1}${2}${NC}"
}

function print_header() {
    print_colored $CYAN "🎯 QuickTalk 全栈开发工具"
    echo ""
}

function check_prerequisites() {
    print_colored $YELLOW "🔍 检查开发环境..."
    
    # 检查 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_colored $GREEN "✅ Node.js: $NODE_VERSION"
    else
        print_colored $RED "❌ Node.js 未安装"
        return 1
    fi
    
    # 检查 Rust
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        print_colored $GREEN "✅ Rust: $RUST_VERSION"
    else
        print_colored $RED "❌ Rust 未安装"
        return 1
    fi
    
    # 检查 cargo-watch
    if command -v cargo-watch &> /dev/null; then
        print_colored $GREEN "✅ cargo-watch 已安装"
    else
        print_colored $YELLOW "⚠️ cargo-watch 未安装，将自动安装"
        cargo install cargo-watch
    fi
    
    return 0
}

function setup_environment() {
    print_colored $CYAN "🛠️ 初始化开发环境..."
    
    if ! check_prerequisites; then
        print_colored $RED "❌ 环境检查失败"
        exit 1
    fi
    
    print_colored $YELLOW "📦 安装前端依赖..."
    cd frontend-react
    npm install
    cd ..
    
    print_colored $YELLOW "🦀 检查后端依赖..."
    cd backend
    cargo check
    cd ..
    
    print_colored $GREEN "✅ 环境初始化完成！"
    echo ""
    print_colored $CYAN "现在可以运行: ./dev.sh dev"
}

function start_development() {
    print_colored $CYAN "🚀 启动 QuickTalk 全栈开发环境..."
    echo ""
    
    if [ ! -f "frontend-react/package.json" ]; then
        print_colored $RED "❌ 前端项目未找到，请先运行 ./dev.sh setup"
        exit 1
    fi
    
    if [ ! -f "backend/Cargo.toml" ]; then
        print_colored $RED "❌ 后端项目未找到"
        exit 1
    fi
    
    print_colored $YELLOW "📝 启动信息:"
    echo "  - 后端服务: http://localhost:3030"
    echo "  - 前端开发: http://localhost:5173"
    echo "  - API 代理: 自动转发到后端"
    echo ""
    print_colored $CYAN "💡 提示: 按 Ctrl+C 停止所有服务"
    echo ""
    
    # 使用 npm 的 concurrently 来启动
    if [ -f "package.json" ]; then
        npm run dev
    else
        # 手动启动两个进程
        cd backend
        cargo watch -x run &
        BACKEND_PID=$!
        cd ../frontend-react
        npm run dev:frontend &
        FRONTEND_PID=$!
        cd ..
        
        # 等待进程
        wait $BACKEND_PID $FRONTEND_PID
    fi
}

function build_production() {
    print_colored $YELLOW "🏗️ 构建生产版本..."
    
    # 构建前端
    print_colored $CYAN "📦 构建前端..."
    cd frontend-react
    npm run build
    cd ..
    
    # 构建后端
    print_colored $YELLOW "🦀 构建后端..."
    cd backend
    cargo build --release
    cd ..
    
    print_colored $GREEN "✅ 生产版本构建完成！"
    echo "  - 前端构建: frontend-react/dist/"
    echo "  - 后端二进制: backend/target/release/"
}

function clean_environment() {
    print_colored $YELLOW "🧹 清理开发环境..."
    
    # 清理前端
    if [ -d "frontend-react/node_modules" ]; then
        print_colored $CYAN "🗑️ 清理前端依赖..."
        rm -rf frontend-react/node_modules
    fi
    
    if [ -d "frontend-react/dist" ]; then
        rm -rf frontend-react/dist
    fi
    
    # 清理后端
    print_colored $YELLOW "🗑️ 清理后端构建..."
    cd backend
    cargo clean
    cd ..
    
    print_colored $GREEN "✅ 清理完成！"
}

function show_help() {
    print_colored $CYAN "🚀 QuickTalk 全栈开发工具"
    echo ""
    print_colored $YELLOW "使用方法:"
    echo "  ./dev.sh setup      # 初始化开发环境"
    echo "  ./dev.sh dev        # 启动前后端热重载开发 (默认)"
    echo "  ./dev.sh build      # 构建生产版本"
    echo "  ./dev.sh clean      # 清理缓存和构建文件"
    echo "  ./dev.sh help       # 显示帮助信息"
    echo ""
    print_colored $GREEN "示例:"
    echo "  ./dev.sh            # 启动开发环境"
    echo "  ./dev.sh setup      # 首次使用"
}

# 主逻辑
print_header

case ${1:-dev} in
    setup)
        setup_environment
        ;;
    dev|start)
        start_development
        ;;
    build)
        build_production
        ;;
    clean)
        clean_environment
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_colored $RED "❌ 未知命令: $1"
        show_help
        exit 1
        ;;
esac