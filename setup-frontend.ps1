# QuickTalk React 前端安装和启动脚本
# 运行此脚本来快速设置开发环境

Write-Host "🚀 正在初始化 QuickTalk React 前端开发环境..." -ForegroundColor Green

# 检查是否在正确的目录
if (!(Test-Path "frontend-react/package.json")) {
    Write-Host "❌ 错误: 请在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 进入前端目录
Set-Location frontend-react

Write-Host "📦 正在安装 NPM 依赖..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ NPM 安装失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 依赖安装完成!" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 环境设置完成! 现在您可以:" -ForegroundColor Green
Write-Host ""
Write-Host "1. 启动后端服务器 (新终端):" -ForegroundColor Cyan
Write-Host "   cd backend && cargo run" -ForegroundColor White
Write-Host ""
Write-Host "2. 启动前端开发服务器:" -ForegroundColor Cyan
Write-Host "   cd frontend-react && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. 访问应用:" -ForegroundColor Cyan
Write-Host "   - React 开发服务器: http://localhost:5173" -ForegroundColor White
Write-Host "   - Rust 后端服务: http://localhost:3030" -ForegroundColor White
Write-Host ""
Write-Host "📚 更多信息请查看 frontend-react/README.md" -ForegroundColor Magenta

# 询问是否立即启动开发服务器
$response = Read-Host "是否现在启动前端开发服务器? (y/N)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🚀 启动前端开发服务器..." -ForegroundColor Green
    npm run dev
}