# 更新部署包脚本 - 清理版本

Write-Host "🚀 更新部署包 (生产版本)" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Blue

# 1. 重新构建SDK
Write-Host "`n📦 构建WebSocket SDK..." -ForegroundColor Yellow
Set-Location "websocket-sdk"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SDK构建失败" -ForegroundColor Red
    exit 1
}
Set-Location ".."

# 2. 重新构建前端
Write-Host "`n🏗️  构建前端..." -ForegroundColor Yellow
Set-Location "frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    exit 1
}
Set-Location ".."

# 3. 清理backend/static目录
Write-Host "`n🧹 清理测试文件..." -ForegroundColor Yellow
$testFiles = @(
    "comprehensive-test.html",
    "debug-imageviewer.html", 
    "final-verification.html",
    "image-test.html",
    "protocol-consistency-test.html",
    "protocol-test.html",
    "simple-test.html",
    "success-celebration.html",
    "test-connection-strategy.html",
    "test-embed.html",
    "test-image-viewer.html",
    "unified-protocol-test.html",
    "README.md"
)

foreach($file in $testFiles) {
    Remove-Item "backend\static\$file" -Force -ErrorAction SilentlyContinue
}

# 4. 复制前端构建结果到backend/static
Write-Host "`n📂 复制前端构建结果..." -ForegroundColor Yellow
Copy-Item "frontend\build\*" "backend\static\" -Recurse -Force

# 5. 交叉编译后端
Write-Host "`n🔨 交叉编译后端..." -ForegroundColor Yellow
Set-Location "backend"
cargo zigbuild --target x86_64-unknown-linux-musl --features="https" --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 后端编译失败" -ForegroundColor Red
    exit 1
}
Set-Location ".."

# 6. 更新部署包
Write-Host "`n📦 更新部署包..." -ForegroundColor Yellow

# 复制编译后的二进制文件
Copy-Item "backend\target\x86_64-unknown-linux-musl\release\customer-service-backend" "ubuntu-deploy-ready\customer-service-backend" -Force

# 复制静态文件（已清理的版本）
Copy-Item "backend\static\*" "ubuntu-deploy-ready\static\" -Recurse -Force

# 再次清理部署包中的测试文件
foreach($file in $testFiles) {
    Remove-Item "ubuntu-deploy-ready\static\$file" -Force -ErrorAction SilentlyContinue
}

# 7. 统计结果
Write-Host "`n✅ 部署包更新完成!" -ForegroundColor Green
Write-Host "`n📊 部署包内容:" -ForegroundColor Blue

$deploySize = (Get-ChildItem "ubuntu-deploy-ready" -Recurse | Measure-Object -Property Length -Sum).Sum
Write-Host "总大小: $([math]::Round($deploySize/1MB, 2)) MB" -ForegroundColor White

Write-Host "`n📋 静态文件清单:" -ForegroundColor Blue
Get-ChildItem "ubuntu-deploy-ready\static" | ForEach-Object {
    $size = if ($_.PSIsContainer) { "目录" } else { "$([math]::Round($_.Length/1KB, 2)) KB" }
    Write-Host "   ✓ $($_.Name) ($size)" -ForegroundColor White
}

Write-Host "`n🎯 部署包已就绪: ubuntu-deploy-ready/" -ForegroundColor Green