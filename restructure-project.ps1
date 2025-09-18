# QuickTalk 项目结构重组脚本

Write-Host "🏗️ 开始重组 QuickTalk 项目结构..." -ForegroundColor Green

# 创建新的目录结构
$directories = @(
    "backend",
    "frontend/public",
    "frontend/src/components",
    "frontend/src/pages",
    "frontend/src/assets",
    "frontend/src/styles",
    "frontend/src/utils",
    "services/nodejs",
    "services/shared",
    "data/database",
    "data/uploads",
    "data/logs",
    "data/temp",
    "docs/api",
    "docs/deployment",
    "docs/architecture",
    "devops/scripts",
    "devops/docker",
    "devops/nginx"
)

Write-Host "📁 创建新目录结构..." -ForegroundColor Yellow
foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "   ✅ 创建: $dir" -ForegroundColor Gray
}

Write-Host "📦 迁移文件..." -ForegroundColor Cyan

# 迁移 Rust 后端
Write-Host "🦀 迁移 Rust 服务器..." -ForegroundColor Magenta
if (Test-Path "rust-server") {
    Move-Item "rust-server/*" "backend/" -Force
    Remove-Item "rust-server" -Recurse -Force
}

# 迁移前端文件
Write-Host "📱 迁移前端文件..." -ForegroundColor Blue
if (Test-Path "static") {
    # 核心页面
    $frontendPages = @("index.html", "admin-mobile.html", "analytics-dashboard.html")
    foreach ($page in $frontendPages) {
        if (Test-Path "static/$page") {
            Move-Item "static/$page" "frontend/src/pages/" -Force
        }
    }
    
    # 静态资源
    if (Test-Path "static/assets") {
        Move-Item "static/assets/*" "frontend/src/assets/" -Force
    }
    if (Test-Path "static/css") {
        Move-Item "static/css/*" "frontend/src/styles/" -Force
    }
    if (Test-Path "static/js") {
        Move-Item "static/js/*" "frontend/src/utils/" -Force
    }
    
    # 公共文件
    Move-Item "static/*" "frontend/public/" -Force -ErrorAction SilentlyContinue
    Remove-Item "static" -Recurse -Force -ErrorAction SilentlyContinue
}

# 迁移 Node.js 服务
Write-Host "🟢 迁移 Node.js 服务..." -ForegroundColor Green
$nodeFiles = @("server.js", "auth-routes.js", "database-sqlite.js", "package.json", "package-lock.json")
foreach ($file in $nodeFiles) {
    if (Test-Path $file) {
        Move-Item $file "services/nodejs/" -Force
    }
}
if (Test-Path "src") {
    Move-Item "src/*" "services/nodejs/src/" -Force
    Remove-Item "src" -Recurse -Force
}

# 迁移数据文件
Write-Host "🗄️ 迁移数据文件..." -ForegroundColor DarkYellow
$dataFolders = @("data", "uploads", "logs", "temp")
foreach ($folder in $dataFolders) {
    if (Test-Path $folder) {
        Move-Item "$folder/*" "data/$folder/" -Force -ErrorAction SilentlyContinue
        Remove-Item $folder -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 迁移文档
Write-Host "📚 迁移文档..." -ForegroundColor Cyan
$docFiles = @("README.md", "docs", "*.md")
foreach ($item in $docFiles) {
    if (Test-Path $item) {
        Move-Item $item "docs/" -Force -ErrorAction SilentlyContinue
    }
}

# 迁移部署脚本
Write-Host "🛠️ 迁移部署脚本..." -ForegroundColor DarkGreen
$scriptFiles = @("start-*.ps1", "start-*.sh", "scripts")
foreach ($item in $scriptFiles) {
    if (Test-Path $item) {
        Move-Item $item "devops/scripts/" -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "🎉 项目结构重组完成！" -ForegroundColor Green
Write-Host ""
Write-Host "新的项目结构:" -ForegroundColor White
Write-Host "📦 QuickTalk/" -ForegroundColor Gray
Write-Host "├── 🦀 backend/          # Rust 主服务器" -ForegroundColor Gray
Write-Host "├── 📱 frontend/         # 前端界面" -ForegroundColor Gray
Write-Host "├── 🟢 services/         # Node.js 微服务" -ForegroundColor Gray
Write-Host "├── 🗄️ data/            # 数据库和文件" -ForegroundColor Gray
Write-Host "├── 📚 docs/            # 文档" -ForegroundColor Gray
Write-Host "└── 🛠️ devops/          # 部署脚本" -ForegroundColor Gray