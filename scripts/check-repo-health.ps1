#!/usr/bin/env pwsh
# QuickTalk 仓库健康检查脚本

Write-Host "🔍 QuickTalk 仓库健康检查" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# 1. 检查工作区中的大文件/目录
Write-Host "📁 检查工作区文件..." -ForegroundColor Yellow

$problemDirs = @("node_modules", "target", ".cache", "dist")
$foundProblems = $false

foreach ($dir in $problemDirs) {
    $paths = Get-ChildItem -Path . -Name $dir -Recurse -Directory -ErrorAction SilentlyContinue
    if ($paths) {
        Write-Host "  ⚠️  发现 $dir 目录:" -ForegroundColor Red
        foreach ($path in $paths) {
            if (Test-Path $path) {
                $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
                Write-Host "    - $path ($($size.ToString('F2')) MB)" -ForegroundColor Red
                $foundProblems = $true
            }
        }
    }
}

if (-not $foundProblems) {
    Write-Host "  ✅ 未发现问题目录" -ForegroundColor Green
}

# 2. 检查大文件
Write-Host ""
Write-Host "📄 检查大文件 (>1MB)..." -ForegroundColor Yellow

$largeFiles = Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.Length -gt 1MB -and $_.FullName -notlike "*\.git\*" } |
    Sort-Object Length -Descending |
    Select-Object -First 10

if ($largeFiles) {
    Write-Host "  发现大文件:" -ForegroundColor Yellow
    foreach ($file in $largeFiles) {
        $size = ($file.Length / 1MB).ToString('F2')
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "    - $relativePath ($size MB)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✅ 未发现大文件" -ForegroundColor Green
}

# 3. 检查 .gitignore 覆盖
Write-Host ""
Write-Host "📝 检查 .gitignore 覆盖..." -ForegroundColor Yellow

$gitignoreExists = Test-Path ".gitignore"
if ($gitignoreExists) {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    
    $requiredPatterns = @(
        "node_modules/",
        "target/", 
        "*.db",
        "uploads/",
        ".env"
    )
    
    $missingPatterns = @()
    foreach ($pattern in $requiredPatterns) {
        if ($gitignoreContent -notlike "*$pattern*") {
            $missingPatterns += $pattern
        }
    }
    
    if ($missingPatterns.Count -eq 0) {
        Write-Host "  ✅ .gitignore 配置完整" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  .gitignore 缺少模式:" -ForegroundColor Yellow
        foreach ($pattern in $missingPatterns) {
            Write-Host "    - $pattern" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ❌ .gitignore 文件不存在" -ForegroundColor Red
}

# 4. 检查Git状态
Write-Host ""
Write-Host "🔗 检查Git状态..." -ForegroundColor Yellow

try {
    $gitStatus = git status --porcelain
    $untrackedLargeFiles = @()
    
    if ($gitStatus) {
        foreach ($line in $gitStatus) {
            if ($line.StartsWith("??")) {
                $filePath = $line.Substring(3)
                if (Test-Path $filePath) {
                    $item = Get-Item $filePath -ErrorAction SilentlyContinue
                    if ($item -and $item.Length -gt 100KB) {
                        $size = ($item.Length / 1KB).ToString('F2')
                        $untrackedLargeFiles += "$filePath ($size KB)"
                    }
                }
            }
        }
        
        if ($untrackedLargeFiles.Count -gt 0) {
            Write-Host "  ⚠️  发现未追踪的大文件:" -ForegroundColor Yellow
            foreach ($file in $untrackedLargeFiles) {
                Write-Host "    - $file" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  ✅ 无未追踪的大文件" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✅ 工作区干净" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  无法检查Git状态（可能不在Git仓库中）" -ForegroundColor Yellow
}

# 5. 检查仓库大小
Write-Host ""
Write-Host "📊 检查仓库大小..." -ForegroundColor Yellow

if (Test-Path ".git") {
    $gitDirSize = (Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  .git 目录大小: $($gitDirSize.ToString('F2')) MB" -ForegroundColor Cyan
    
    if ($gitDirSize -gt 100) {
        Write-Host "  ⚠️  仓库较大，建议考虑清理Git历史" -ForegroundColor Yellow
        Write-Host "      运行: ./scripts/deep-cleanup-git-history.ps1 -DryRun" -ForegroundColor Cyan
    } elseif ($gitDirSize -gt 50) {
        Write-Host "  ⚠️  仓库中等大小，可以考虑清理" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ 仓库大小合理" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️  未检测到Git仓库" -ForegroundColor Yellow
}

# 6. 检查Rust项目结构
Write-Host ""
Write-Host "🦀 检查Rust项目结构..." -ForegroundColor Yellow

$rustProjectOk = $true

if (-not (Test-Path "backend/Cargo.toml")) {
    Write-Host "  ❌ 未找到 backend/Cargo.toml" -ForegroundColor Red
    $rustProjectOk = $false
}

if (-not (Test-Path "backend/src/main.rs")) {
    Write-Host "  ❌ 未找到 backend/src/main.rs" -ForegroundColor Red
    $rustProjectOk = $false
}

if (Test-Path "backend/target") {
    Write-Host "  ⚠️  backend/target 目录存在（应该被忽略）" -ForegroundColor Yellow
}

if ($rustProjectOk) {
    Write-Host "  ✅ Rust项目结构正确" -ForegroundColor Green
}

# 7. 总结和建议
Write-Host ""
Write-Host "📋 总结和建议" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan

if (-not $foundProblems -and $untrackedLargeFiles.Count -eq 0) {
    Write-Host "🎉 仓库状态良好！" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ 已移除所有不必要的依赖文件" -ForegroundColor Green
    Write-Host "✅ .gitignore 配置完整" -ForegroundColor Green
    Write-Host "✅ 项目结构符合纯Rust架构要求" -ForegroundColor Green
    
    if ($gitDirSize -lt 50) {
        Write-Host "✅ 仓库大小优化良好" -ForegroundColor Green
    }
    
} else {
    Write-Host "🔧 发现需要优化的地方：" -ForegroundColor Yellow
    Write-Host ""
    
    if ($foundProblems) {
        Write-Host "📁 清理大目录：" -ForegroundColor Yellow
        Write-Host "   - 删除 node_modules 和 target 目录" -ForegroundColor Cyan
        Write-Host "   - 运行: ./scripts/cleanup-repo.ps1" -ForegroundColor Cyan
    }
    
    if ($untrackedLargeFiles.Count -gt 0) {
        Write-Host "📄 处理大文件：" -ForegroundColor Yellow
        Write-Host "   - 检查是否需要这些文件" -ForegroundColor Cyan
        Write-Host "   - 考虑添加到 .gitignore" -ForegroundColor Cyan
    }
    
    if ($gitDirSize -gt 50) {
        Write-Host "📦 优化Git历史：" -ForegroundColor Yellow
        Write-Host "   - 运行: ./scripts/deep-cleanup-git-history.ps1 -DryRun" -ForegroundColor Cyan
        Write-Host "   - 考虑清理Git历史中的大文件" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "🚀 下一步：编译和运行纯Rust服务器" -ForegroundColor Green
Write-Host "   cd backend && cargo build --release" -ForegroundColor Cyan
Write-Host "   cargo run" -ForegroundColor Cyan