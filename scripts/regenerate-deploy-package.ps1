# 重新生成Ubuntu部署包的脚本
# 用于修复数据库兼容性和配置问题

Write-Host "🔧 开始重新生成Ubuntu部署包..." -ForegroundColor Yellow

# 1. 重新编译后端（确保使用最新代码）
Write-Host "📦 重新编译后端..." -ForegroundColor Blue
Set-Location backend
cargo build --release --bin customer-service-backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 后端编译失败" -ForegroundColor Red
    exit 1
}

# 2. 复制最新的可执行文件
Write-Host "📁 复制最新可执行文件..." -ForegroundColor Blue
Copy-Item "target/release/customer-service-backend.exe" "../ubuntu-deploy-ready/customer-service-backend" -Force

# 3. 重新构建前端
Write-Host "🌐 重新构建前端..." -ForegroundColor Blue
Set-Location ../frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    exit 1
}

# 4. 复制前端静态文件
Write-Host "📂 复制前端静态文件..." -ForegroundColor Blue
Remove-Item "../ubuntu-deploy-ready/static" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "build" "../ubuntu-deploy-ready/static" -Recurse -Force

# 5. 重新构建SDK
Write-Host "🔧 重新构建SDK..." -ForegroundColor Blue
Set-Location ../websocket-sdk
npm run build

# 6. 清理可能的旧数据库文件
Write-Host "🗑️ 清理旧数据库文件..." -ForegroundColor Blue
Remove-Item "../ubuntu-deploy-ready/customer_service.db" -ErrorAction SilentlyContinue

# 7. 更新环境配置（确保使用正确的数据库路径）
Write-Host "⚙️ 更新环境配置..." -ForegroundColor Blue
$envContent = @"
# ELonTalk 客服系统 - Ubuntu 生产环境配置
# 部署路径: /root/ubuntu-deploy-ready/

# ========== 数据库配置 ==========
DATABASE_URL=sqlite:/root/ubuntu-deploy-ready/customer_service.db

# 跳过数据库迁移（使用 Sea-ORM 自动迁移）
DISABLE_MIGRATION=false

# ========== JWT 安全配置 ==========
JWT_SECRET=your-super-secret-jwt-key-please-change-in-production-env-2025

# ========== 服务器配置 ==========
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# ========== HTTPS/TLS 配置（强制启用）==========
TLS_MODE=https
TLS_PORT=8443
ENABLE_HTTP_REDIRECT=true
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key

# ========== 公网配置 ==========
PUBLIC_DOMAIN=43.139.82.12
PUBLIC_IP=43.139.82.12

# ========== 日志配置 ==========
RUST_LOG=info,customer_service_backend=debug

# ========== 其他配置 ==========
RUST_BACKTRACE=1
TZ=Asia/Shanghai
"@

Set-Content "../ubuntu-deploy-ready/.env" $envContent -Encoding UTF8

Write-Host "✅ Ubuntu部署包重新生成完成!" -ForegroundColor Green
Write-Host "📁 部署包位置: ubuntu-deploy-ready/" -ForegroundColor Cyan
Write-Host "⚠️  注意: 上传后，数据库将重新创建（旧数据会丢失）" -ForegroundColor Yellow

# 返回根目录
Set-Location ..