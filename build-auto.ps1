# 自动化构建和部署脚本
# 支持本地构建和远程部署

param(
    [string]$Target = "local",  # local, deploy, both
    [string]$Server = "",       # 服务器地址
    [string]$User = "root",     # SSH用户名
    [string]$Path = "/opt/customer-service"  # 服务器部署路径
)

function Write-ColorText($Text, $Color = "White") {
    Write-Host $Text -ForegroundColor $Color
}

function Check-Dependency($Command, $Name) {
    try {
        & $Command --version | Out-Null
        Write-ColorText "✅ $Name 已安装" "Green"
        return $true
    } catch {
        Write-ColorText "❌ $Name 未安装" "Red"
        return $false
    }
}

Write-ColorText "========================================" "Green"
Write-ColorText "    客服系统 - 自动化构建部署" "Green"  
Write-ColorText "========================================" "Green"
Write-ColorText ""

# 检查依赖
Write-ColorText "🔍 检查构建环境..." "Blue"
$rustOk = Check-Dependency "rustc" "Rust"
$cargoOk = Check-Dependency "cargo" "Cargo"

if (-not ($rustOk -and $cargoOk)) {
    Write-ColorText "❌ 构建环境不完整，请安装Rust" "Red"
    exit 1
}

if ($Target -eq "deploy" -or $Target -eq "both") {
    if (-not $Server) {
        Write-ColorText "❌ 部署模式需要指定服务器地址" "Red"
        Write-ColorText "用法: .\build-auto.ps1 -Target deploy -Server your-server.com" "Yellow"
        exit 1
    }
    
    $sshOk = Check-Dependency "ssh" "SSH"
    $scpOk = Check-Dependency "scp" "SCP"
    
    if (-not ($sshOk -and $scpOk)) {
        Write-ColorText "❌ 部署环境不完整，请安装SSH客户端" "Red"
        exit 1
    }
}

if ($Target -eq "local" -or $Target -eq "both") {
    Write-ColorText "📦 开始本地构建..." "Blue"
    
    # 运行构建脚本
    try {
        .\build-ubuntu.ps1
        Write-ColorText "✅ 本地构建完成" "Green"
    } catch {
        Write-ColorText "❌ 构建失败: $_" "Red"
        exit 1
    }
}

if ($Target -eq "deploy" -or $Target -eq "both") {
    Write-ColorText "🚀 开始远程部署..." "Blue"
    
    $deployDir = "backend\ubuntu-deploy"
    
    if (-not (Test-Path $deployDir)) {
        Write-ColorText "❌ 部署包不存在，请先构建" "Red"
        exit 1
    }
    
    try {
        # 上传文件
        Write-ColorText "📤 上传文件到服务器..." "Cyan"
        scp -r $deployDir "${User}@${Server}:${Path}-temp"
        
        # 在服务器上执行部署
        Write-ColorText "⚙️  在服务器上执行部署..." "Cyan"
        $deployScript = @"
#!/bin/bash
set -e

echo "🔄 开始服务器端部署..."

# 停止现有服务
if systemctl is-active --quiet customer-service 2>/dev/null; then
    echo "🛑 停止现有服务..."
    sudo systemctl stop customer-service
fi

# 备份现有部署
if [ -d "${Path}" ]; then
    echo "💾 备份现有部署..."
    sudo mv "${Path}" "${Path}.backup.\$(date +%Y%m%d_%H%M%S)"
fi

# 移动新部署
echo "📦 安装新版本..."
sudo mv "${Path}-temp" "${Path}"
cd "${Path}"

# 设置权限
sudo chmod +x customer-service-backend
sudo chmod +x start-server.sh
sudo chmod +x setup-duckdns-ssl.sh

# 安装/更新systemd服务
if [ -f customer-service.service ]; then
    echo "⚙️  更新systemd服务..."
    sudo cp customer-service.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable customer-service
fi

# 配置SSL（如果尚未配置）
if [ ! -f certs/server.crt ] && [ -f setup-duckdns-ssl.sh ]; then
    echo "🔐 检测到SSL配置脚本..."
    echo "💡 请手动运行: sudo ./setup-duckdns-ssl.sh"
fi

echo "✅ 服务器端部署完成"
echo "🚀 启动服务: sudo systemctl start customer-service"
echo "📊 查看状态: sudo systemctl status customer-service"
echo "📋 查看日志: sudo journalctl -u customer-service -f"
"@
        
        # 写入临时脚本并执行
        $scriptContent = $deployScript -replace "`n", "`n"
        ssh "${User}@${Server}" "echo '$scriptContent' > /tmp/deploy.sh && chmod +x /tmp/deploy.sh && /tmp/deploy.sh && rm /tmp/deploy.sh"
        
        Write-ColorText "✅ 远程部署完成" "Green"
        Write-ColorText ""
        Write-ColorText "🎊 部署成功！" "Green"
        Write-ColorText "🌐 访问地址: https://$Server:8443" "Yellow"
        Write-ColorText ""
        Write-ColorText "📋 管理命令:" "Cyan"
        Write-ColorText "  启动服务: ssh $User@$Server 'sudo systemctl start customer-service'" "White"
        Write-ColorText "  查看状态: ssh $User@$Server 'sudo systemctl status customer-service'" "White"
        Write-ColorText "  查看日志: ssh $User@$Server 'sudo journalctl -u customer-service -f'" "White"
        
    } catch {
        Write-ColorText "❌ 部署失败: $_" "Red"
        exit 1
    }
}

Write-ColorText ""
Write-ColorText "🎉 所有操作完成！" "Green"