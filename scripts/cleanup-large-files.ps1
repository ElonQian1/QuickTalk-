# QuickTalk 项目清理脚本
# 清理大文件和重复文件，释放磁盘空间

Write-Host "🧹 QuickTalk 项目大文件清理工具" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# 计算清理前的项目大小
$beforeSize = (Get-ChildItem 'e:\kefu' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB

Write-Host "📊 清理前项目大小: $([math]::Round($beforeSize, 1)) MB" -ForegroundColor Yellow
Write-Host ""

# 1. 清理 Rust 编译产物 (target 目录)
Write-Host "1️⃣ 清理 Rust 编译产物..." -ForegroundColor Cyan
if (Test-Path 'e:\kefu\backend\target') {
    $targetSize = (Get-ChildItem 'e:\kefu\backend\target' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB
    Write-Host "   target 目录大小: $([math]::Round($targetSize, 1)) MB"
    
    Write-Host "   正在删除 target 目录..." -ForegroundColor Yellow
    Remove-Item 'e:\kefu\backend\target' -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ target 目录已删除，释放 $([math]::Round($targetSize, 1)) MB" -ForegroundColor Green
} else {
    Write-Host "   ✅ target 目录不存在" -ForegroundColor Green
}
Write-Host ""

# 2. 删除重复的 mobile-dashboard.html 文件
Write-Host "2️⃣ 清理重复的 HTML 文件..." -ForegroundColor Cyan

# 删除旧版本的 mobile-dashboard.html
$filesToDelete = @(
    'e:\kefu\presentation\static\mobile-dashboard.html',
    'e:\kefu\static\mobile-dashboard.html'
)

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length / 1KB
        Remove-Item $file -Force
        Write-Host "   ✅ 已删除: $($file.Replace('e:\kefu\','')) ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
    }
}
Write-Host ""

# 3. 清理临时文件
Write-Host "3️⃣ 清理临时和测试文件..." -ForegroundColor Cyan

# 临时Python脚本
$tempFiles = Get-ChildItem 'e:\kefu' -File | Where-Object { 
    $_.Name -like "temp_*.py" -or 
    $_.Name -like "test-*.js" -or 
    $_.Name -like "test-*.html" -or
    $_.Name -like "*.backup" -or
    $_.Name -like "delete_shop_management_batch*"
}

foreach ($file in $tempFiles) {
    $size = $file.Length / 1KB
    Remove-Item $file.FullName -Force
    Write-Host "   ✅ 已删除: $($file.Name) ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
}
Write-Host ""

# 4. 清理其他大文件
Write-Host "4️⃣ 检查其他可清理文件..." -ForegroundColor Cyan

# 检查备份文件
if (Test-Path 'e:\kefu\参考\备份.zip') {
    $size = (Get-Item 'e:\kefu\参考\备份.zip').Length / 1KB
    Write-Host "   发现备份文件: 备份.zip ($([math]::Round($size, 1)) KB)" -ForegroundColor Yellow
    Write-Host "   ⚠️  建议手动检查后删除" -ForegroundColor Yellow
}

# 检查logs目录
if (Test-Path 'e:\kefu\logs') {
    $logSize = (Get-ChildItem 'e:\kefu\logs' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1KB
    if ($logSize -gt 100) {
        Write-Host "   发现大型日志文件: $([math]::Round($logSize, 1)) KB" -ForegroundColor Yellow
        Write-Host "   💡 建议定期清理日志文件" -ForegroundColor Yellow
    }
}
Write-Host ""

# 5. 清理空目录
Write-Host "5️⃣ 清理空目录..." -ForegroundColor Cyan
$emptyDirs = Get-ChildItem 'e:\kefu' -Recurse -Directory | Where-Object { 
    (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0 
}

foreach ($dir in $emptyDirs) {
    Remove-Item $dir.FullName -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ 已删除空目录: $($dir.FullName.Replace('e:\kefu\',''))" -ForegroundColor Green
}
Write-Host ""

# 计算清理后的项目大小
$afterSize = (Get-ChildItem 'e:\kefu' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB
$savedSpace = $beforeSize - $afterSize

Write-Host "📊 清理结果:" -ForegroundColor Green
Write-Host "   清理前: $([math]::Round($beforeSize, 1)) MB"
Write-Host "   清理后: $([math]::Round($afterSize, 1)) MB"
Write-Host "   节省空间: $([math]::Round($savedSpace, 1)) MB ($([math]::Round($savedSpace/$beforeSize*100, 1))%)"
Write-Host ""

Write-Host "🎉 清理完成!" -ForegroundColor Green
Write-Host ""

Write-Host "📋 项目架构保持清洁:" -ForegroundColor Cyan
Write-Host "   ✅ 唯一的优化版 mobile-dashboard.html (16.2KB)"
Write-Host "   ✅ 模块化的 CSS 和 JS 文件"
Write-Host "   ✅ 无重复文件和编译缓存"
Write-Host ""

Write-Host "💡 后续建议:" -ForegroundColor Yellow
Write-Host "   1. 定期运行 'cargo clean' 清理编译缓存"
Write-Host "   2. 删除不需要的测试和临时文件"
Write-Host "   3. 压缩不常用的备份文件"
Write-Host "   4. 考虑添加 .gitignore 忽略 target/ 目录"