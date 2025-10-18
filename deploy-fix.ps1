# 修复 SQL 歧义错误后的快速部署脚本
# 用途: 编译后端并复制到 Ubuntu 部署包

Write-Host "🔨 开始编译后端 (Release)..." -ForegroundColor Cyan

# 编译后端
Set-Location backend
cargo build --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 编译失败!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 编译成功!" -ForegroundColor Green

# 返回根目录
Set-Location ..

# 复制到部署包
Write-Host "📦 复制到部署包..." -ForegroundColor Cyan
Copy-Item "backend\target\release\customer-service-backend.exe" "ubuntu-deploy-ready\customer-service-backend" -Force

if (Test-Path "ubuntu-deploy-ready\customer-service-backend") {
    Write-Host "✅ 部署包已更新!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 下一步:" -ForegroundColor Yellow
    Write-Host "  1. 上传 ubuntu-deploy-ready 目录到 Ubuntu 服务器"
    Write-Host "  2. 重启服务: sudo systemctl restart customer-service"
    Write-Host "  3. 查看日志: sudo journalctl -u customer-service -f"
} else {
    Write-Host "❌ 复制失败!" -ForegroundColor Red
    exit 1
}
