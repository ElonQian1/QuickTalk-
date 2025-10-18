# ELonTalk 客服系统 - 部署前检查脚本
# 确保所有必需文件都已准备就绪

param(
    [switch]$Verbose
)

Write-Host ""
Write-Host "=========================================="
Write-Host "  ELonTalk 部署包完整性检查"
Write-Host "=========================================="
Write-Host ""

$deployPath = "E:\duihua\customer-service-system\ubuntu-deploy-ready"
$allChecksPassed = $true

# 检查部署目录是否存在
if (-not (Test-Path $deployPath)) {
    Write-Host "❌ 错误: 部署目录不存在: $deployPath" -ForegroundColor Red
    exit 1
}

Write-Host "📁 部署目录: $deployPath" -ForegroundColor Cyan
Write-Host ""

# 1. 检查后端程序
Write-Host "1️⃣  检查后端程序..." -ForegroundColor Yellow
$backend = Get-Item "$deployPath\customer-service-backend" -ErrorAction SilentlyContinue
if ($backend) {
    $sizeMB = [math]::Round($backend.Length / 1MB, 2)
    $age = (Get-Date) - $backend.LastWriteTime
    
    Write-Host "   ✅ 文件存在: customer-service-backend" -ForegroundColor Green
    Write-Host "   📦 大小: $sizeMB MB" -ForegroundColor Gray
    Write-Host "   🕒 最后编译: $($backend.LastWriteTime)" -ForegroundColor Gray
    
    if ($age.TotalMinutes -gt 60) {
        Write-Host "   ⚠️  警告: 程序已超过 1 小时未更新" -ForegroundColor Yellow
    }
    
    if ($sizeMB -lt 5 -or $sizeMB -gt 20) {
        Write-Host "   ⚠️  警告: 文件大小异常 (期望: 10-12 MB)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ 缺失: customer-service-backend" -ForegroundColor Red
    $allChecksPassed = $false
}
Write-Host ""

# 2. 检查配置文件
Write-Host "2️⃣  检查配置文件..." -ForegroundColor Yellow
$configFiles = @(".env.production", ".env.staging")
foreach ($config in $configFiles) {
    if (Test-Path "$deployPath\$config") {
        Write-Host "   ✅ $config" -ForegroundColor Green
        
        if ($Verbose) {
            $content = Get-Content "$deployPath\$config" | Select-String -Pattern "ACME_ENABLED|TLS_MODE|DATABASE_URL"
            Write-Host "      配置摘要:" -ForegroundColor Gray
            $content | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        }
    } else {
        Write-Host "   ❌ 缺失: $config" -ForegroundColor Red
        $allChecksPassed = $false
    }
}
Write-Host ""

# 3. 检查启动脚本
Write-Host "3️⃣  检查启动脚本..." -ForegroundColor Yellow
$requiredScripts = @("start-production.sh", "deploy.sh")
foreach ($script in $requiredScripts) {
    if (Test-Path "$deployPath\$script") {
        Write-Host "   ✅ $script" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 缺失: $script" -ForegroundColor Red
        $allChecksPassed = $false
    }
}
Write-Host ""

# 4. 检查前端文件
Write-Host "4️⃣  检查前端静态文件..." -ForegroundColor Yellow
if (Test-Path "$deployPath\static") {
    $staticFiles = Get-ChildItem "$deployPath\static" -Recurse -File
    $totalSize = ($staticFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    
    Write-Host "   ✅ static/ 目录存在" -ForegroundColor Green
    Write-Host "   📦 文件数量: $($staticFiles.Count)" -ForegroundColor Gray
    Write-Host "   📦 总大小: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
    
    # 检查关键文件
    $criticalFiles = @("index.html", "static/js/main.*.js", "asset-manifest.json")
    foreach ($file in $criticalFiles) {
        $found = Get-ChildItem "$deployPath\static" -Recurse -Filter $file -ErrorAction SilentlyContinue
        if ($found) {
            Write-Host "   ✅ 关键文件: $file" -ForegroundColor Green
        } else {
            Write-Host "   ❌ 缺失关键文件: $file" -ForegroundColor Red
            $allChecksPassed = $false
        }
    }
} else {
    Write-Host "   ❌ static/ 目录不存在" -ForegroundColor Red
    $allChecksPassed = $false
}
Write-Host ""

# 5. 检查证书目录
Write-Host "5️⃣  检查 HTTPS 证书目录..." -ForegroundColor Yellow
if (Test-Path "$deployPath\certs") {
    Write-Host "   ✅ certs/ 目录存在" -ForegroundColor Green
    
    $certFiles = Get-ChildItem "$deployPath\certs" -Filter "*.crt"
    $keyFiles = Get-ChildItem "$deployPath\certs" -Filter "*.key"
    
    Write-Host "   📄 证书文件: $($certFiles.Count)" -ForegroundColor Gray
    Write-Host "   🔑 密钥文件: $($keyFiles.Count)" -ForegroundColor Gray
    
    if ($certFiles.Count -eq 0 -or $keyFiles.Count -eq 0) {
        Write-Host "   ⚠️  提示: 证书文件为空，将使用 ACME 自动申请" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  certs/ 目录不存在（将自动创建）" -ForegroundColor Yellow
}
Write-Host ""

# 6. 检查数据库架构
Write-Host "6️⃣  检查数据库配置..." -ForegroundColor Yellow
if (Test-Path "$deployPath\database_schema.sql") {
    Write-Host "   ✅ database_schema.sql (仅供参考)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  database_schema.sql 不存在" -ForegroundColor Yellow
}
Write-Host "   💡 使用 Sea-ORM 自动迁移" -ForegroundColor Gray
Write-Host ""

# 7. 计算总大小
Write-Host "7️⃣  部署包统计..." -ForegroundColor Yellow
$allFiles = Get-ChildItem $deployPath -Recurse -File
$totalSize = ($allFiles | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "   📦 总文件数: $($allFiles.Count)" -ForegroundColor Gray
Write-Host "   📦 总大小: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

# 最终结果
Write-Host "=========================================="
if ($allChecksPassed) {
    Write-Host "  ✅ 所有检查通过！可以部署" -ForegroundColor Green
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "📋 下一步操作:" -ForegroundColor Cyan
    Write-Host "   1. 运行上传脚本:" -ForegroundColor White
    Write-Host "      .\upload-to-ubuntu.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. 或手动上传:" -ForegroundColor White
    Write-Host "      scp -r ubuntu-deploy-ready root@43.139.82.12:/root/" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "  ❌ 部分检查未通过，请修复问题" -ForegroundColor Red
    Write-Host "=========================================="
    Write-Host ""
    exit 1
}
