#!/usr/bin/env pwsh
# QuickTalk 仓库清理脚本 - 移除大文件和不需要的依赖

Write-Host "🧹 开始清理 QuickTalk 仓库..." -ForegroundColor Green
Write-Host ""

# 1. 清理当前工作区的不必要文件
Write-Host "📁 清理工作区文件..." -ForegroundColor Yellow

# 移除 node_modules（如果存在）
if (Test-Path "node_modules") {
    Write-Host "  ❌ 删除根目录 node_modules ($(((Get-ChildItem node_modules -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB).ToString('F2')) MB)" -ForegroundColor Red
    Remove-Item -Path "node_modules" -Recurse -Force
}

if (Test-Path "frontend/node_modules") {
    Write-Host "  ❌ 删除 frontend/node_modules" -ForegroundColor Red
    Remove-Item -Path "frontend/node_modules" -Recurse -Force
}

if (Test-Path "services/nodejs/node_modules") {
    Write-Host "  ❌ 删除 services/nodejs/node_modules" -ForegroundColor Red
    Remove-Item -Path "services/nodejs/node_modules" -Recurse -Force
}

# 移除 Rust target 目录
if (Test-Path "backend/target") {
    Write-Host "  ❌ 删除 backend/target ($(((Get-ChildItem backend/target -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB).ToString('F2')) MB)" -ForegroundColor Red
    Remove-Item -Path "backend/target" -Recurse -Force
}

# 移除临时和缓存文件
$tempFiles = @("*.tmp", "*.temp", "*.log", ".cache")
foreach ($pattern in $tempFiles) {
    $files = Get-ChildItem -Path . -Name $pattern -Recurse
    if ($files) {
        Write-Host "  ❌ 删除临时文件: $pattern" -ForegroundColor Red
        Remove-Item -Path $files -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""

# 2. 从 Git 中移除大文件（如果它们被追踪了）
Write-Host "🗂️  检查Git追踪的文件..." -ForegroundColor Yellow

$trackedLargeFiles = git ls-files | Where-Object { 
    $file = $_
    (Test-Path $file) -and ((Get-Item $file).Length -gt 100KB)
}

if ($trackedLargeFiles) {
    Write-Host "  发现被Git追踪的大文件:" -ForegroundColor Red
    foreach ($file in $trackedLargeFiles) {
        $size = ((Get-Item $file).Length / 1KB).ToString('F2')
        Write-Host "    - $file ($size KB)" -ForegroundColor Red
    }
}

# 3. 使用 git filter-repo 清理历史（如果需要）
Write-Host ""
Write-Host "🔍 检查是否需要清理Git历史..." -ForegroundColor Yellow

# 检查仓库大小
$repoSize = (Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  当前 .git 目录大小: $($repoSize.ToString('F2')) MB" -ForegroundColor Cyan

if ($repoSize -gt 50) {
    Write-Host "  ⚠️  仓库较大，建议清理Git历史" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🚨 警告：以下操作将重写Git历史！" -ForegroundColor Red
    Write-Host "   建议先备份仓库，或者在新分支上操作" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "是否要清理Git历史中的大文件？(y/N)"
    
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host ""
        Write-Host "🧽 开始清理Git历史..." -ForegroundColor Green
        
        # 移除历史中的大文件
        $filesToRemove = @(
            "data/customer_service.db",
            "*.db",
            "improved-code-duplication-analysis.json",
            "node_modules",
            "target",
            "*.log"
        )
        
        foreach ($pattern in $filesToRemove) {
            Write-Host "  🗑️  移除历史中的: $pattern" -ForegroundColor Red
            git filter-branch --force --index-filter "git rm -rf --cached --ignore-unmatch $pattern" --prune-empty --tag-name-filter cat -- --all
        }
        
        # 清理引用
        Write-Host "  🧹 清理Git引用..." -ForegroundColor Yellow
        git for-each-ref --format="%(refname)" refs/original/ | ForEach-Object { git update-ref -d $_ }
        
        # 清理和压缩
        Write-Host "  📦 压缩仓库..." -ForegroundColor Yellow
        git reflog expire --expire=now --all
        git gc --prune=now --aggressive
        
        $newRepoSize = (Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        $savedSpace = $repoSize - $newRepoSize
        Write-Host "  ✅ 清理完成！节省空间: $($savedSpace.ToString('F2')) MB" -ForegroundColor Green
        Write-Host "  📊 新的仓库大小: $($newRepoSize.ToString('F2')) MB" -ForegroundColor Cyan
    }
}

# 4. 提交新的 .gitignore
Write-Host ""
Write-Host "📝 提交更新的 .gitignore..." -ForegroundColor Yellow

git add .gitignore
$gitStatus = git status --porcelain
if ($gitStatus) {
    git commit -m "🧹 更新 .gitignore - 为纯Rust架构优化

- 添加完整的 Rust 项目忽略规则
- 忽略 node_modules 和其他Node.js遗留文件  
- 忽略 target 目录和Cargo构建产物
- 添加数据库文件、日志文件等忽略规则
- 为纯Rust部署环境优化配置"

    Write-Host "  ✅ .gitignore 更新已提交" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  没有需要提交的更改" -ForegroundColor Cyan
}

# 5. 显示清理结果
Write-Host ""
Write-Host "🎉 仓库清理完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📊 清理摘要:" -ForegroundColor Cyan
Write-Host "  ✅ 已删除工作区中的 node_modules 和 target 目录" -ForegroundColor Green
Write-Host "  ✅ 已更新 .gitignore 以防止将来的问题" -ForegroundColor Green
Write-Host "  ✅ 配置适用于纯Rust架构部署" -ForegroundColor Green

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "  ✅ 已清理Git历史中的大文件" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  重要提醒:" -ForegroundColor Yellow
    Write-Host "   - Git历史已被重写，如果这是共享仓库，需要协调团队成员" -ForegroundColor Yellow
    Write-Host "   - 建议使用 'git push --force-with-lease' 推送更改" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 现在您的仓库已为纯Rust架构优化！" -ForegroundColor Green
Write-Host "   可以使用 'cargo build --release' 构建Rust应用" -ForegroundColor Cyan