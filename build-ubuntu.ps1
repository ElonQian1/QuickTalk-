# ELonTalk Ubuntu 交叉编译脚本 (PowerShell)
# 支持 HTTPS，生成完整部署包

Write-Host "🔨 ELonTalk Ubuntu 交叉编译和打包" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# 配置参数
$BuildTarget = "x86_64-unknown-linux-musl"
$OutputDir = "ubuntu-deploy-package"
$CurrentDate = Get-Date -Format "yyyy-MM-dd"

# 检查必要工具
Write-Host "🔍 检查编译环境..." -ForegroundColor Yellow

# 检查 Rust 目标
$targets = rustup target list --installed
if ($targets -notmatch "x86_64-unknown-linux-musl") {
    Write-Host "🔧 安装 Linux musl 目标..." -ForegroundColor Yellow
    rustup target add x86_64-unknown-linux-musl
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 无法安装 Linux 目标" -ForegroundColor Red
        exit 1
    }
}

# 检查 cargo-zigbuild
try {
    cargo zigbuild --version | Out-Null
} catch {
    Write-Host "🔧 安装 cargo-zigbuild..." -ForegroundColor Yellow
    cargo install cargo-zigbuild
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 无法安装 cargo-zigbuild" -ForegroundColor Red
        exit 1
    }
}

# 检查 zig
try {
    zig version | Out-Null
} catch {
    Write-Host "❌ 缺少 zig，请运行: winget install zig.zig" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 编译环境检查完成" -ForegroundColor Green
Write-Host ""

# 清理和创建输出目录
if (Test-Path $OutputDir) {
    Write-Host "🧹 清理旧的输出目录..." -ForegroundColor Yellow
    Remove-Item -Path $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

# 交叉编译
Write-Host "🔨 开始交叉编译 (HTTPS版本)..." -ForegroundColor Yellow
Set-Location backend

# 清理编译缓存
cargo clean --target $BuildTarget

# 执行编译
cargo zigbuild --release --target $BuildTarget --features https
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 编译失败" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✅ 编译成功" -ForegroundColor Green
Set-Location ..

# 复制文件
Write-Host "📁 复制文件到部署包..." -ForegroundColor Yellow

# 复制二进制文件
$binaryPath = "backend\target\$BuildTarget\release\customer-service-backend"
Copy-Item $binaryPath "$OutputDir\" -Force

# 复制项目文件
$filesToCopy = @(
    "database_schema.sql",
    "setup-duckdns-ssl.sh"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item $file "$OutputDir\" -Force
    }
}

# 复制环境配置
if (Test-Path ".env.https") {
    Copy-Item ".env.https" "$OutputDir\.env.production" -Force
}
if (Test-Path ".env.example") {
    Copy-Item ".env.example" "$OutputDir\" -Force
}

# 复制证书目录
if (Test-Path "certs") {
    Copy-Item "certs" "$OutputDir\certs" -Recurse -Force
}

# 复制静态文件
$staticPaths = @("backend\static", "static")
foreach ($path in $staticPaths) {
    if (Test-Path $path) {
        Copy-Item $path "$OutputDir\static" -Recurse -Force
        break
    }
}

# 创建启动脚本
$startScript = @"
#!/bin/bash
# ELonTalk 启动脚本

echo "🚀 启动 ELonTalk 客服系统..."

# 设置权限
chmod +x customer-service-backend

# 检查环境配置
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 配置文件"
    fi
fi

# 启动服务
echo "🌟 启动服务器 (HTTP模式)..."
./customer-service-backend
"@

$startScript | Out-File -FilePath "$OutputDir\start.sh" -Encoding UTF8

# 创建 HTTPS 启动脚本
$httpsScript = @"
#!/bin/bash
# ELonTalk HTTPS 启动脚本

echo "🔒 启动 ELonTalk HTTPS 服务..."

# 检查证书
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo "❌ SSL 证书不存在，请运行: sudo ./setup-duckdns-ssl.sh"
    exit 1
fi

# 设置权限
chmod +x customer-service-backend

# 设置 HTTPS 环境变量
export TLS_ENABLED=true
export TLS_PORT=8443
export TLS_CERT_PATH=certs/server.crt
export TLS_KEY_PATH=certs/server.key

# 启动 HTTPS 服务
echo "🌟 启动 HTTPS 服务器..."
./customer-service-backend
"@

$httpsScript | Out-File -FilePath "$OutputDir\start-https.sh" -Encoding UTF8

# 创建部署说明
$readme = @"
# ELonTalk 客服系统 - Ubuntu 部署包

**编译时间**: $CurrentDate
**目标平台**: Linux x86_64 (Ubuntu 16.04+)
**编译版本**: HTTPS 支持版本

## 快速部署

``````bash
# 1. 上传到服务器
scp -r $OutputDir user@server:/opt/elontalk/

# 2. 设置权限并启动
ssh user@server
cd /opt/elontalk/$OutputDir
chmod +x *.sh
./start.sh                    # HTTP 模式
# 或
sudo ./setup-duckdns-ssl.sh   # 配置 SSL 证书
./start-https.sh              # HTTPS 模式
``````

## 文件说明

- `customer-service-backend`: 主程序 (静态链接)
- `start.sh`: HTTP 启动脚本
- `start-https.sh`: HTTPS 启动脚本
- `setup-duckdns-ssl.sh`: SSL 证书自动配置
- `database_schema.sql`: 数据库结构
- `.env.example`: 配置模板

## 端口说明

- HTTP: 8080
- HTTPS: 8443

## 支持功能

✅ 完整客服系统  
✅ WebSocket 实时通信  
✅ SQLite 数据库  
✅ HTTPS/SSL 支持  
✅ 文件上传  
✅ 多店铺管理  
✅ Let's Encrypt 自动证书  

---
构建时间: $CurrentDate
"@

$readme | Out-File -FilePath "$OutputDir\README.md" -Encoding UTF8

# 显示结果
Write-Host ""
Write-Host "🎉 Ubuntu 交叉编译和打包完成！" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 输出目录: $OutputDir" -ForegroundColor Cyan
Write-Host "📁 包含文件:" -ForegroundColor Cyan
Get-ChildItem $OutputDir | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }

Write-Host ""
Write-Host "📊 二进制文件信息:" -ForegroundColor Cyan
$binaryFile = Get-Item "$OutputDir\customer-service-backend"
$sizeMB = [math]::Round($binaryFile.Length / 1024 / 1024, 1)
Write-Host "  文件大小: $($binaryFile.Length) 字节 (约 $sizeMB MB)" -ForegroundColor White

Write-Host ""
Write-Host "🚀 部署方式:" -ForegroundColor Yellow
Write-Host "1. 上传 $OutputDir 目录到 Ubuntu 服务器" -ForegroundColor White
Write-Host "2. 运行: chmod +x *.sh customer-service-backend" -ForegroundColor White
Write-Host "3. 运行: ./start.sh (HTTP) 或 ./start-https.sh (HTTPS)" -ForegroundColor White

Write-Host ""
Write-Host "✅ 完整的部署包已准备就绪！" -ForegroundColor Green
