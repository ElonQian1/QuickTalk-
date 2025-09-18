# QuickTalk 混合架构启动脚本 (Windows)

Write-Host "🚀 启动 QuickTalk 混合架构系统..." -ForegroundColor Green

# 检查Rust是否安装
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust/Cargo 未安装。请先安装Rust: https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# 检查Node.js是否安装
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js 未安装。请先安装Node.js" -ForegroundColor Red
    exit 1
}

Write-Host "📦 安装Node.js依赖..." -ForegroundColor Yellow
npm install

Write-Host "🦀 构建Rust服务器..." -ForegroundColor Cyan
Set-Location rust-server
cargo build --release
Set-Location ..

Write-Host "🔧 创建必要目录..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path data, logs, uploads, temp

Write-Host "✅ 启动系统服务..." -ForegroundColor Green
Write-Host "🦀 Rust主服务器将在端口3030启动" -ForegroundColor Cyan
Write-Host "📱 Node.js微服务将在端口3031启动" -ForegroundColor Blue
Write-Host ""
Write-Host "访问地址:" -ForegroundColor White
Write-Host "  主页: http://localhost:3030/" -ForegroundColor Gray
Write-Host "  管理后台: http://localhost:3030/admin" -ForegroundColor Gray
Write-Host "  API状态: http://localhost:3030/api/health" -ForegroundColor Gray
Write-Host "  WebSocket: ws://localhost:3030/ws" -ForegroundColor Gray
Write-Host ""

# 启动混合架构
npm run start:hybrid