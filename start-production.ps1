# 生产环境启动脚本

# 设置生产环境变量
$env:NODE_ENV="production"

# 启动生产服务器
Write-Host "🚀 启动QuickTalk客服系统（生产模式）..." -ForegroundColor Green

# 检查Node.js版本
$nodeVersion = node --version
Write-Host "Node.js版本: $nodeVersion" -ForegroundColor Yellow

# 检查依赖是否已安装
if (!(Test-Path "node_modules")) {
    Write-Host "📦 安装依赖包..." -ForegroundColor Yellow
    npm install --production
}

# 启动服务器
Write-Host "✅ 启动服务器..." -ForegroundColor Green
npm start