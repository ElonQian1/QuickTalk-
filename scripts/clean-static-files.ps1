# 清理静态文件目录中的测试和调试文件

param(
    [string]$StaticPath = "backend\static"
)

Write-Host "🧹 开始清理测试文件..." -ForegroundColor Green

# 需要删除的测试文件列表
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

# 保留的核心文件
$coreFiles = @(
    "index.html",           # 主页面
    "manifest.json",        # PWA配置
    "robots.txt",          # SEO文件
    "favicon.ico",         # 网站图标
    "favicon.svg",         # SVG图标
    "logo192.svg",         # 应用图标
    "logo512.svg",         # 应用图标
    "asset-manifest.json", # 资源清单
    "embed/",              # SDK嵌入文件
    "sdk/",                # SDK文件
    "static/",             # 前端构建文件
    "uploads/"             # 上传文件目录
)

$fullStaticPath = Join-Path $PWD $StaticPath

if (-not (Test-Path $fullStaticPath)) {
    Write-Host "❌ 路径不存在: $fullStaticPath" -ForegroundColor Red
    exit 1
}

Write-Host "📂 清理目录: $fullStaticPath" -ForegroundColor Yellow
Write-Host ""

$deletedCount = 0
$totalSize = 0

foreach ($file in $testFiles) {
    $filePath = Join-Path $fullStaticPath $file
    if (Test-Path $filePath) {
        $fileInfo = Get-Item $filePath
        $size = $fileInfo.Length
        $totalSize += $size
        
        Write-Host "🗑️  删除: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Cyan
        Remove-Item $filePath -Force
        $deletedCount++
    }
}

Write-Host ""
Write-Host "✅ 清理完成!" -ForegroundColor Green
Write-Host "📊 统计信息:" -ForegroundColor Yellow
Write-Host "   - 删除文件数: $deletedCount" -ForegroundColor White
Write-Host "   - 节省空间: $([math]::Round($totalSize/1KB, 2)) KB" -ForegroundColor White
Write-Host ""

# 显示剩余文件
Write-Host "📋 保留的核心文件:" -ForegroundColor Green
Get-ChildItem $fullStaticPath | ForEach-Object {
    $size = if ($_.PSIsContainer) { "文件夹" } else { "$([math]::Round($_.Length/1KB, 2)) KB" }
    Write-Host "   ✓ $($_.Name) ($size)" -ForegroundColor White
}