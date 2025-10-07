#!/usr/bin/env powershell

# QuickTalk 一键启动脚本 - Windows PowerShell 版本
# 使用方法: .\start-dev.ps1

param(
    [switch]$Setup,
    [switch]$Clean,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Write-Header {
    Write-Host ""
    Write-Host "🚀 QuickTalk 全栈开发环境" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "📝 $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Show-Help {
    Write-Header
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  .\start-dev.ps1           # 启动前后端开发服务器 (默认)"
    Write-Host "  .\start-dev.ps1 -Setup    # 安装依赖和初始化环境"
    Write-Host "  .\start-dev.ps1 -BackendOnly   # 仅启动后端"
    Write-Host "  .\start-dev.ps1 -FrontendOnly  # 仅启动前端" 
    Write-Host "  .\start-dev.ps1 -Clean    # 清理构建文件"
    Write-Host "  .\start-dev.ps1 -Help     # 显示帮助"
    Write-Host ""
    Write-Host "示例:" -ForegroundColor Green
    Write-Host "  .\start-dev.ps1           # 最常用命令"
    Write-Host "  .\start-dev.ps1 -Setup    # 首次使用"
}

function Test-Environment {
    Write-Info "检查开发环境..."
    
    # 检查 Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js: $nodeVersion"
    } catch {
        Write-Error "Node.js 未安装或不在 PATH 中"
        return $false
    }
    
    # 检查 Rust
    try {
        $rustVersion = rustc --version
        Write-Success "Rust: $rustVersion"
    } catch {
        Write-Error "Rust 未安装或不在 PATH 中"
        return $false
    }
    
    # 检查项目文件
    if (!(Test-Path "frontend-react/package.json")) {
        Write-Error "前端项目未找到，请先运行: .\start-dev.ps1 -Setup"
        return $false
    }
    
    if (!(Test-Path "backend/Cargo.toml")) {
        Write-Error "后端项目未找到"
        return $false
    }
    
    return $true
}

function Install-Dependencies {
    Write-Header
    Write-Info "正在安装依赖..."
    
    # 安装 cargo-watch
    Write-Info "检查 cargo-watch..."
    try {
        cargo watch --version | Out-Null
        Write-Success "cargo-watch 已安装"
    } catch {
        Write-Info "正在安装 cargo-watch..."
        cargo install cargo-watch
    }
    
    # 安装前端依赖
    Write-Info "安装前端依赖..."
    Set-Location "frontend-react"
    npm install
    Set-Location ".."
    
    # 安装根目录依赖 (concurrently)
    Write-Info "安装开发工具..."
    npm install
    
    Write-Success "环境设置完成！"
    Write-Host ""
    Write-Host "现在可以运行: .\start-dev.ps1" -ForegroundColor Cyan
}

function Start-FullStack {
    Write-Header
    
    if (!(Test-Environment)) {
        Write-Host ""
        Write-Host "请先运行: .\start-dev.ps1 -Setup" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Info "启动信息:"
    Write-Host "  🦀 后端服务: http://localhost:3030" -ForegroundColor Yellow
    Write-Host "  ⚛️ 前端开发: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  🔄 API 代理: 自动转发" -ForegroundColor Blue
    Write-Host ""
    Write-Host "💡 按 Ctrl+C 停止所有服务" -ForegroundColor Magenta
    Write-Host ""
    
    # 使用 npm concurrently 启动
    npm run dev
}

function Start-BackendOnly {
    Write-Header
    Write-Info "启动后端 (热重载)..."
    Set-Location "backend"
    cargo watch -x run
}

function Start-FrontendOnly {
    Write-Header
    Write-Info "启动前端 (热重载)..."
    Set-Location "frontend-react"
    npm run dev:frontend
}

function Clean-All {
    Write-Header
    Write-Info "清理开发环境..."
    
    # 清理前端
    if (Test-Path "frontend-react/node_modules") {
        Write-Info "清理前端依赖..."
        Remove-Item "frontend-react/node_modules" -Recurse -Force
    }
    
    if (Test-Path "frontend-react/dist") {
        Remove-Item "frontend-react/dist" -Recurse -Force
    }
    
    # 清理后端
    Write-Info "清理后端构建..."
    Set-Location "backend"
    cargo clean
    Set-Location ".."
    
    # 清理根目录
    if (Test-Path "node_modules") {
        Remove-Item "node_modules" -Recurse -Force
    }
    
    Write-Success "清理完成！"
}

# 主逻辑
try {
    switch ($true) {
        $Help { Show-Help }
        $Setup { Install-Dependencies }
        $Clean { Clean-All }
        $BackendOnly { Start-BackendOnly }
        $FrontendOnly { Start-FrontendOnly }
        default { Start-FullStack }
    }
} catch {
    Write-Error "执行失败: $($_.Exception.Message)"
    exit 1
}