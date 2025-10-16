# 证书续期脚本
# renew-cert.ps1

Write-Host "🔄 开始续期证书..." -ForegroundColor Green

# 续期证书
certbot renew --force-renewal

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 证书续期成功" -ForegroundColor Green
    
    # 自动复制新证书
    $certPath = "C:\Certbot\live\elontalk.duckdns.org"
    $deployPath = "E:\duihua\customer-service-system\ubuntu-deploy-ready\certs"
    
    Copy-Item "$certPath\fullchain.pem" "$deployPath\server.crt" -Force
    Copy-Item "$certPath\privkey.pem" "$deployPath\server.key" -Force
    
    Write-Host "✅ 新证书已复制到部署目录" -ForegroundColor Green
    Write-Host "🚀 请重新上传 certs 目录到服务器" -ForegroundColor Yellow
} else {
    Write-Host "❌ 证书续期失败" -ForegroundColor Red
}