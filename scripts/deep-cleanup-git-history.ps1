#!/usr/bin/env pwsh
# Git 历史清理脚本 - 可选的深度清理
# 警告：这会重写Git历史，请确保备份！

param(
    [switch]$DryRun,
    [switch]$Force
)

Write-Host "🚨 Git 历史清理工具 - QuickTalk 纯Rust版本" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "⚠️  警告：此脚本将重写Git历史！" -ForegroundColor Yellow
    Write-Host "   这是一个危险操作，会改变所有提交的SHA值" -ForegroundColor Yellow
    Write-Host "   如果这是共享仓库，需要所有协作者重新克隆" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "建议：" -ForegroundColor Cyan
    Write-Host "  1. 先备份整个仓库目录" -ForegroundColor Cyan
    Write-Host "  2. 确保没有其他人在使用此仓库" -ForegroundColor Cyan
    Write-Host "  3. 在新分支上测试此操作" -ForegroundColor Cyan
    Write-Host ""
    
    $response = Read-Host "您确定要继续吗？请输入 'YES' 确认"
    if ($response -ne "YES") {
        Write-Host "操作已取消" -ForegroundColor Green
        exit 0
    }
}

# 检查是否安装了 git-filter-repo
Write-Host "🔍 检查依赖工具..." -ForegroundColor Yellow
try {
    $null = Get-Command git-filter-repo -ErrorAction Stop
    Write-Host "  ✅ git-filter-repo 已安装" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 未找到 git-filter-repo" -ForegroundColor Red
    Write-Host ""
    Write-Host "安装方法:" -ForegroundColor Cyan
    Write-Host "  pip install git-filter-repo" -ForegroundColor Cyan
    Write-Host "  或从 https://github.com/newren/git-filter-repo 下载" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "使用传统的 filter-branch 替代方案..." -ForegroundColor Yellow
}

# 分析当前仓库大小
Write-Host ""
Write-Host "📊 分析仓库..." -ForegroundColor Yellow

$gitDirSize = (Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  当前 .git 大小: $($gitDirSize.ToString('F2')) MB" -ForegroundColor Cyan

# 查找大文件
Write-Host "  查找历史中的大文件..." -ForegroundColor Cyan
$largeFiles = git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | Where-Object { $_ -match '^blob' -and [int]($_.Split(' ')[2]) -gt 100000 } | Sort-Object { [int]($_.Split(' ')[2]) } -Descending | Select-Object -First 20

Write-Host "  发现的大文件 (>100KB):" -ForegroundColor Red
foreach ($file in $largeFiles) {
    $parts = $file.Split(' ', 4)
    $size = ([int]$parts[2] / 1KB).ToString('F2')
    $filename = if ($parts.Length -gt 3) { $parts[3] } else { "unknown" }
    Write-Host "    $filename - $size KB" -ForegroundColor Red
}

if ($DryRun) {
    Write-Host ""
    Write-Host "🔍 DryRun 模式 - 不执行实际清理" -ForegroundColor Cyan
    Write-Host "如果执行清理，将移除以下文件类型:" -ForegroundColor Cyan
    $patterns = @(
        "data/customer_service.db",
        "*.db",
        "*.sqlite",
        "improved-code-duplication-analysis.json",
        "node_modules/",
        "target/",
        "*.log",
        "uploads/",
        ".cache/"
    )
    foreach ($pattern in $patterns) {
        Write-Host "  - $pattern" -ForegroundColor Yellow
    }
    exit 0
}

# 执行清理
Write-Host ""
Write-Host "🧽 开始清理Git历史..." -ForegroundColor Green

# 要移除的文件模式
$filesToRemove = @(
    "data/customer_service.db",
    "*.db",
    "*.sqlite",
    "improved-code-duplication-analysis.json",
    "node_modules",
    "**/node_modules/**",
    "target",
    "**/target/**",
    "*.log",
    "uploads/**",
    ".cache/**",
    "*.tmp",
    "*.temp"
)

# 使用 git filter-repo (如果可用)
try {
    $null = Get-Command git-filter-repo -ErrorAction Stop
    
    Write-Host "  使用 git-filter-repo 清理..." -ForegroundColor Yellow
    foreach ($pattern in $filesToRemove) {
        Write-Host "    移除: $pattern" -ForegroundColor Red
        git filter-repo --path-glob $pattern --invert-paths --force
    }
    
} catch {
    # 使用传统的 filter-branch
    Write-Host "  使用 filter-branch 清理..." -ForegroundColor Yellow
    
    # 创建备份
    git tag backup-before-cleanup HEAD
    Write-Host "    已创建备份标签: backup-before-cleanup" -ForegroundColor Cyan
    
    foreach ($pattern in $filesToRemove) {
        Write-Host "    移除: $pattern" -ForegroundColor Red
        git filter-branch --force --index-filter "git rm -rf --cached --ignore-unmatch '$pattern'" --prune-empty --tag-name-filter cat -- --all
    }
    
    # 清理 filter-branch 的备份
    Write-Host "  清理临时文件..." -ForegroundColor Yellow
    git for-each-ref --format="%(refname)" refs/original/ | ForEach-Object { 
        git update-ref -d $_
    }
}

# 清理和压缩
Write-Host "  清理引用和压缩仓库..." -ForegroundColor Yellow
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 显示结果
$newGitDirSize = (Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
$savedSpace = $gitDirSize - $newGitDirSize
$compressionRatio = (($savedSpace / $gitDirSize) * 100).ToString('F1')

Write-Host ""
Write-Host "🎉 清理完成！" -ForegroundColor Green
Write-Host "📊 清理结果:" -ForegroundColor Cyan
Write-Host "  原始大小: $($gitDirSize.ToString('F2')) MB" -ForegroundColor Cyan
Write-Host "  清理后大小: $($newGitDirSize.ToString('F2')) MB" -ForegroundColor Green
Write-Host "  节省空间: $($savedSpace.ToString('F2')) MB ($compressionRatio%)" -ForegroundColor Green

Write-Host ""
Write-Host "📝 后续步骤:" -ForegroundColor Yellow
Write-Host "  1. 验证仓库功能正常: git log --oneline" -ForegroundColor Cyan
Write-Host "  2. 如果满意结果，删除备份: git tag -d backup-before-cleanup" -ForegroundColor Cyan
Write-Host "  3. 强制推送到远程: git push --force-with-lease --all" -ForegroundColor Cyan
Write-Host "  4. 通知团队成员重新克隆仓库" -ForegroundColor Cyan

Write-Host ""
Write-Host "⚠️  重要提醒:" -ForegroundColor Red
Write-Host "   所有提交的SHA值都已改变" -ForegroundColor Red
Write-Host "   如果这是共享仓库，所有协作者都需要重新克隆" -ForegroundColor Red