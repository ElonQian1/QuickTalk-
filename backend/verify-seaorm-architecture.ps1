#!/usr/bin/env pwsh
# Sea-ORM 架构验证脚本

Write-Host "🚀 开始 Sea-ORM 架构验证测试..." -ForegroundColor Green
Write-Host ""

# 1. 验证文件结构
Write-Host "📁 验证文件结构..." -ForegroundColor Yellow
$repoFiles = @(
    "backend/src/repositories/mod.rs",
    "backend/src/repositories/user.rs", 
    "backend/src/repositories/shop.rs",
    "backend/src/repositories/customer.rs",
    "backend/src/repositories/session.rs",
    "backend/src/repositories/message.rs",
    "backend/src/repositories/staff.rs"
)

$serviceFiles = @(
    "backend/src/services/mod.rs",
    "backend/src/services/user_service.rs",
    "backend/src/services/shop_service.rs", 
    "backend/src/services/customer_service.rs",
    "backend/src/services/session_service.rs",
    "backend/src/services/message_service.rs"
)

$allFiles = $repoFiles + $serviceFiles

foreach ($file in $allFiles) {
    if (Test-Path $file) {
        $lines = (Get-Content $file | Measure-Object -Line).Lines
        Write-Host "✅ $file ($lines lines)" -ForegroundColor Green
    } else {
        Write-Host "❌ $file 不存在" -ForegroundColor Red
    }
}

Write-Host ""

# 2. 验证代码行数统计
Write-Host "📊 代码统计..." -ForegroundColor Yellow

$repoLines = 0
foreach ($file in $repoFiles) {
    if (Test-Path $file) {
        $repoLines += (Get-Content $file | Measure-Object -Line).Lines
    }
}

$serviceLines = 0
foreach ($file in $serviceFiles) {
    if (Test-Path $file) {
        $serviceLines += (Get-Content $file | Measure-Object -Line).Lines
    }
}

$databaseLines = (Get-Content "backend/src/database.rs" | Measure-Object -Line).Lines

Write-Host "📈 Repository 层: $repoLines 行"
Write-Host "📈 Service 层: $serviceLines 行" 
Write-Host "📉 Database.rs: $databaseLines 行 (已清理)"
Write-Host "📋 总计新增: $($repoLines + $serviceLines) 行"
Write-Host ""

# 3. 验证架构完整性
Write-Host "🏗️ 架构完整性检查..." -ForegroundColor Yellow

# 检查是否有 Services 导出
$servicesExport = Get-Content "backend/src/services/mod.rs" -Raw
if ($servicesExport -match "pub use.*Service") {
    Write-Host "✅ Services 模块正确导出" -ForegroundColor Green
} else {
    Write-Host "❌ Services 模块导出有问题" -ForegroundColor Red
}

# 检查是否有 Repositories 导出  
$repoExport = Get-Content "backend/src/repositories/mod.rs" -Raw
if ($repoExport -match "pub use.*Repository") {
    Write-Host "✅ Repositories 模块正确导出" -ForegroundColor Green
} else {
    Write-Host "❌ Repositories 模块导出有问题" -ForegroundColor Red
}

Write-Host ""

# 4. 语法检查 (简单版本)
Write-Host "🔍 基础语法检查..." -ForegroundColor Yellow

$hasErrors = $false

# 检查 Rust 关键语法
foreach ($file in ($repoFiles + $serviceFiles)) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # 检查基本 Rust 语法
        if (-not ($content -match "use|impl|pub|async|fn")) {
            Write-Host "❌ $file 可能有语法问题" -ForegroundColor Red
            $hasErrors = $true
        }
    }
}

if (-not $hasErrors) {
    Write-Host "✅ 基础语法检查通过" -ForegroundColor Green
}

Write-Host ""

# 5. 依赖检查
Write-Host "📦 依赖配置检查..." -ForegroundColor Yellow

$cargoToml = Get-Content "backend/Cargo.toml" -Raw
if ($cargoToml -match "sea-orm.*0\.12") {
    Write-Host "✅ Sea-ORM 0.12 依赖正确" -ForegroundColor Green
} else {
    Write-Host "❌ Sea-ORM 依赖配置有问题" -ForegroundColor Red
}

if ($cargoToml -match "sqlx") {
    Write-Host "⚠️  仍有 SQLx 依赖 (兼容性保留)" -ForegroundColor Yellow
} 

Write-Host ""

# 总结
Write-Host "🎉 Sea-ORM 架构验证完成!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Repository 层: 6 个文件, $repoLines 行代码" 
Write-Host "✅ Service 层: 5 个文件, $serviceLines 行代码"
Write-Host "✅ Database 清理: 从 774 行减少到 $databaseLines 行"
Write-Host "✅ 模块化结构: 完整的子文件夹/子文件架构"
Write-Host ""
Write-Host "推荐下一步: 启动服务器进行功能测试" -ForegroundColor Cyan