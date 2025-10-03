[CmdletBinding()]
param(
    [switch]$Clean,
    [string]$TargetDir
)

# 1) 固定到脚本所在目录（backend 根）
Set-Location -Path $PSScriptRoot

Write-Host "[QuickTalk] 前台启动准备..." -ForegroundColor Cyan

# 2) 结束可能残留的 quicktalk-server.exe（避免 Windows 文件锁）
try {
    $procs = Get-Process -Name quicktalk-server -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "[QuickTalk] 发现 ${($procs | Measure-Object).Count} 个 quicktalk-server 实例，正在终止..." -ForegroundColor Yellow
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
    }
} catch {}

# 3) 释放 3030 端口（如果被占用）
try {
    $connections = Get-NetTCPConnection -LocalPort 3030 -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -and ($procId -ne $PID)) {
                Write-Host "[QuickTalk] 释放端口: 3030 -> 结束 PID $procId" -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 300
    }
} catch {
    # 兼容旧环境：降级用 netstat 解析 PID
    $lines = (& netstat -ano | Select-String ":3030")
    foreach ($line in $lines) {
        $tokens = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
        if ($tokens.Length -gt 0) {
            $pidToken = $tokens[-1]
            if ($pidToken -match '^[0-9]+$') {
                try { Stop-Process -Id [int]$pidToken -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    }
}

# 4) 环境变量（仅影响本次前台进程，不产生后台）
$env:RUST_LOG = "info"
if ($TargetDir) {
    Write-Host "[QuickTalk] 使用自定义 target 目录: $TargetDir" -ForegroundColor DarkCyan
    $env:CARGO_TARGET_DIR = $TargetDir
}

# 可选：清理构建
if ($Clean) {
    Write-Host "[QuickTalk] 执行 cargo clean ..." -ForegroundColor DarkGray
    cargo clean
}

# 5) 以“前台”方式启动（可 Ctrl+C 退出）
Write-Host "[QuickTalk] 正在以前台方式启动: cargo run ..." -ForegroundColor Green
cargo run