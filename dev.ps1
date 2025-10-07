# QuickTalk 全栈开发启动脚本
# 类似 npm run tauri dev 的一键启动体验

param(
    [string]$Mode = "dev",
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Setup,
    [switch]$Clean,
    [switch]$Build,
    [switch]$Help
)

# 颜色定义
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Magenta = "`e[35m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

function Write-ColorText {
    param([string]$Text, [string]$Color = $Reset)
    Write-Host "$Color$Text$Reset"
}

function Show-Help {
    Write-ColorText "🚀 QuickTalk 全栈开发工具" $Cyan
    Write-Host ""
    Write-ColorText "使用方法:" $Yellow
    Write-Host "  .\dev.ps1                    # 启动前后端热重载开发"
    Write-Host "  .\dev.ps1 -Setup            # 初始化开发环境"
    Write-Host "  .\dev.ps1 -BackendOnly      # 仅启动后端"
    Write-Host "  .\dev.ps1 -FrontendOnly     # 仅启动前端"
    Write-Host "  .\dev.ps1 -Build            # 构建生产版本"
    Write-Host "  .\dev.ps1 -Clean            # 清理缓存和构建文件"
    Write-Host "  .\dev.ps1 -Help             # 显示帮助信息"
    Write-Host ""
    Write-ColorText "示例:" $Green
    Write-Host "  .\dev.ps1                    # 最常用：同时启动前后端开发服务器"
    Write-Host "  .\dev.ps1 -Setup            # 首次使用：安装所有依赖"
}

function Test-Prerequisites {
    Write-ColorText "🔍 检查开发环境..." $Yellow
    
    # 检查 Node.js
    try {
        $nodeVersion = node --version 2>$null
        Write-ColorText "✅ Node.js: $nodeVersion" $Green
    } catch {
        Write-ColorText "❌ Node.js 未安装或不在 PATH 中" $Red
        return $false
    }
    
    # 检查 Rust
    try {
        $rustVersion = rustc --version 2>$null
        Write-ColorText "✅ Rust: $rustVersion" $Green
    } catch {
        Write-ColorText "❌ Rust 未安装或不在 PATH 中" $Red
        return $false
    }
    
    # 检查 cargo-watch
    try {
        cargo watch --version 2>$null | Out-Null
        Write-ColorText "✅ cargo-watch 已安装" $Green
    } catch {
        Write-ColorText "⚠️ cargo-watch 未安装，将自动安装" $Yellow
        cargo install cargo-watch
    }
    
    return $true
}

function Setup-Environment {
    Write-ColorText "🛠️ 初始化开发环境..." $Cyan
    
    if (-not (Test-Prerequisites)) {
        Write-ColorText "❌ 环境检查失败，请安装必要的依赖" $Red
        exit 1
    }
    
    Write-ColorText "📦 安装前端依赖..." $Yellow
    Set-Location "frontend-react"
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "❌ 前端依赖安装失败" $Red
        exit 1
    }
    
    Set-Location ".."
    
    Write-ColorText "🦀 检查后端依赖..." $Yellow
    Set-Location "backend"
    cargo check
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "❌ 后端检查失败" $Red
        exit 1
    }
    
    Set-Location ".."
    
    Write-ColorText "✅ 环境初始化完成！" $Green
    Write-Host ""
    Write-ColorText "现在可以运行: .\dev.ps1" $Cyan
}

function Start-Backend {
    Write-ColorText "🦀 启动 Rust 后端 (热重载)..." $Yellow
    Set-Location "backend"
    
    # 使用 cargo-watch 进行热重载
    if (Get-Command "cargo-watch" -ErrorAction SilentlyContinue) {
        cargo watch -x run
    } else {
        Write-ColorText "⚠️ cargo-watch 未找到，使用普通模式..." $Yellow
        cargo run
    }
}

function Start-Frontend {
    Write-ColorText "⚛️ 启动 React 前端 (热重载)..." $Cyan
    Set-Location "frontend-react"
    npm run dev:frontend
}

function Start-Development {
    Write-ColorText "🚀 启动 QuickTalk 全栈开发环境..." $Cyan
    Write-Host ""
    
    if (-not (Test-Path "frontend-react/package.json")) {
        Write-ColorText "❌ 前端项目未找到，请先运行 .\dev.ps1 -Setup" $Red
        exit 1
    }
    
    if (-not (Test-Path "backend/Cargo.toml")) {
        Write-ColorText "❌ 后端项目未找到" $Red
        exit 1
    }
    
    Write-ColorText "📝 启动信息:" $Yellow
    Write-Host "  - 后端服务: http://localhost:3030"
    Write-Host "  - 前端开发: http://localhost:5173"
    Write-Host "  - API 代理: 自动转发到后端"
    Write-Host ""
    Write-ColorText "💡 提示: 按 Ctrl+C 停止所有服务" $Magenta
    Write-Host ""
    
    # 启动并发进程
    $jobs = @()
    
    # 启动后端
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        Set-Location "backend"
        if (Get-Command "cargo-watch" -ErrorAction SilentlyContinue) {
            cargo watch -x run
        } else {
            cargo run
        }
    }
    $jobs += $backendJob
    
    # 等待一下让后端先启动
    Start-Sleep -Seconds 2
    
    # 启动前端
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        Set-Location "frontend-react"
        npm run dev:frontend
    }
    $jobs += $frontendJob
    
    # 监控任务
    try {
        while ($true) {
            foreach ($job in $jobs) {
                if ($job.State -eq "Failed") {
                    Write-ColorText "❌ 进程异常退出" $Red
                    break
                }
            }
            
            # 显示任务输出
            foreach ($job in $jobs) {
                $output = Receive-Job $job -ErrorAction SilentlyContinue
                if ($output) {
                    Write-Host $output
                }
            }
            
            Start-Sleep -Seconds 1
        }
    } finally {
        # 清理任务
        foreach ($job in $jobs) {
            Stop-Job $job -ErrorAction SilentlyContinue
            Remove-Job $job -ErrorAction SilentlyContinue
        }
    }
}

function Build-Production {
    Write-ColorText "🏗️ 构建生产版本..." $Yellow
    
    # 构建前端
    Write-ColorText "📦 构建前端..." $Cyan
    Set-Location "frontend-react"
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "❌ 前端构建失败" $Red
        exit 1
    }
    
    Set-Location ".."
    
    # 构建后端
    Write-ColorText "🦀 构建后端..." $Yellow
    Set-Location "backend"
    cargo build --release
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "❌ 后端构建失败" $Red
        exit 1
    }
    
    Set-Location ".."
    
    Write-ColorText "✅ 生产版本构建完成！" $Green
    Write-Host "  - 前端构建: frontend-react/dist/"
    Write-Host "  - 后端二进制: backend/target/release/"
}

function Clean-Environment {
    Write-ColorText "🧹 清理开发环境..." $Yellow
    
    # 清理前端
    if (Test-Path "frontend-react/node_modules") {
        Write-ColorText "🗑️ 清理前端依赖..." $Cyan
        Remove-Item "frontend-react/node_modules" -Recurse -Force
    }
    
    if (Test-Path "frontend-react/dist") {
        Remove-Item "frontend-react/dist" -Recurse -Force
    }
    
    # 清理后端
    Write-ColorText "🗑️ 清理后端构建..." $Yellow
    Set-Location "backend"
    cargo clean
    Set-Location ".."
    
    Write-ColorText "✅ 清理完成！" $Green
}

# 主逻辑
if ($Help) {
    Show-Help
    exit 0
}

Write-ColorText "🎯 QuickTalk 全栈开发工具" $Magenta
Write-Host ""

switch ($true) {
    $Setup { Setup-Environment }
    $Clean { Clean-Environment }
    $Build { Build-Production }
    $BackendOnly { Start-Backend }
    $FrontendOnly { Start-Frontend }
    default { Start-Development }
}