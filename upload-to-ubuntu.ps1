# ELonTalk 客服系统 - 快速上传到 Ubuntu 服务器
# 执行路径: E:\duihua\customer-service-system\

Write-Host "=========================================="
Write-Host "  ELonTalk 客服系统 - 上传到服务器"
Write-Host "=========================================="

$SERVER = "root@43.139.82.12"
$LOCAL_PATH = "ubuntu-deploy-ready"
$REMOTE_PATH = "/root/"

Write-Host ""
Write-Host "📦 准备上传文件..."
Write-Host "   本地路径: $LOCAL_PATH"
Write-Host "   服务器: $SERVER"
Write-Host "   远程路径: $REMOTE_PATH"
Write-Host ""

# 检查本地目录
if (-not (Test-Path $LOCAL_PATH)) {
    Write-Host "❌ 错误: 本地目录不存在: $LOCAL_PATH" -ForegroundColor Red
    exit 1
}

# 检查关键文件
$requiredFiles = @(
    "$LOCAL_PATH\customer-service-backend",
    "$LOCAL_PATH\.env.production",
    "$LOCAL_PATH\start-production.sh",
    "$LOCAL_PATH\static\index.html"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ 错误: 缺少必需文件:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    exit 1
}

# 显示文件大小
$backendSize = (Get-Item "$LOCAL_PATH\customer-service-backend").Length / 1MB
Write-Host "✅ 后端程序大小: $([math]::Round($backendSize, 2)) MB"

$staticCount = (Get-ChildItem "$LOCAL_PATH\static" -Recurse -File).Count
Write-Host "✅ 前端文件数量: $staticCount"

Write-Host ""
Write-Host "🚀 开始上传..."
Write-Host ""

# 使用 scp 上传整个目录
$scpCommand = "scp -r $LOCAL_PATH ${SERVER}:${REMOTE_PATH}"
Write-Host "执行命令: $scpCommand"
Write-Host ""

try {
    & scp -r $LOCAL_PATH "${SERVER}:${REMOTE_PATH}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=========================================="
        Write-Host "  ✅ 上传成功！"
        Write-Host "=========================================="
        Write-Host ""
        Write-Host "📋 下一步操作:"
        Write-Host ""
        Write-Host "1. SSH 登录服务器:"
        Write-Host "   ssh $SERVER"
        Write-Host ""
        Write-Host "2. 进入项目目录:"
        Write-Host "   cd /root/ubuntu-deploy-ready"
        Write-Host ""
        Write-Host "3. 启动生产服务:"
        Write-Host "   chmod +x start-production.sh"
        Write-Host "   ./start-production.sh"
        Write-Host ""
        Write-Host "=========================================="
        Write-Host "  访问地址"
        Write-Host "=========================================="
        Write-Host "🔒 HTTPS: https://elontalk.duckdns.org:8443"
        Write-Host "🌐 HTTP:  http://43.139.82.12:8080"
        Write-Host "=========================================="
    } else {
        Write-Host ""
        Write-Host "❌ 上传失败！错误代码: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ 上传过程中发生错误: $_" -ForegroundColor Red
    exit 1
}
