# 快速同步静态文件到Ubuntu生产服务器
# 用于热修复静态资源404问题

$SERVER = "root@43.139.82.12"
$REMOTE_PATH = "/root/ubuntu-deploy-ready/static"
$LOCAL_PATH = "E:\duihua\customer-service-system\ubuntu-deploy-ready\static"

Write-Host "🚀 开始同步静态文件到Ubuntu服务器..." -ForegroundColor Green

# 同步embed目录
Write-Host "📦 同步 embed 目录..." -ForegroundColor Cyan
scp -r "$LOCAL_PATH\embed" "${SERVER}:${REMOTE_PATH}/"

# 同步sdk目录
Write-Host "📦 同步 sdk 目录..." -ForegroundColor Cyan
scp -r "$LOCAL_PATH\sdk" "${SERVER}:${REMOTE_PATH}/"

Write-Host "✅ 静态文件同步完成！" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 验证URL:" -ForegroundColor Yellow
Write-Host "  https://43.139.82.12:8443/static/embed/service-standalone.js"
Write-Host "  https://43.139.82.12:8443/static/embed/styles.css"
Write-Host ""
Write-Host "💡 现在可以刷新你的BBS页面测试嵌入脚本了！" -ForegroundColor Magenta
