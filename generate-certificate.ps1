# ELonTalk 证书生成脚本
# 为 elontalk.duckdns.org 生成自签名证书

Write-Host "🔐 为 elontalk.duckdns.org 生成自签名证书..." -ForegroundColor Green

try {
    # 生成自签名证书
    $cert = New-SelfSignedCertificate `
        -DnsName "elontalk.duckdns.org", "localhost", "127.0.0.1" `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1") `
        -NotAfter (Get-Date).AddDays(365) `
        -KeyExportPolicy Exportable `
        -KeySpec KeyExchange

    Write-Host "✅ 证书生成成功!" -ForegroundColor Green
    Write-Host "证书指纹: $($cert.Thumbprint)" -ForegroundColor Yellow

    # 导出证书 (CRT格式)
    $certPath = "certs\server.crt"
    Export-Certificate -Cert $cert -FilePath $certPath -Type CERT
    Write-Host "✅ 证书已导出到: $certPath" -ForegroundColor Green

    # 导出私钥 (PFX格式，然后转换为PEM)
    $pfxPath = "certs\server.pfx"
    $password = ConvertTo-SecureString -String "elontalk2024" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password
    Write-Host "✅ 私钥已导出到: $pfxPath" -ForegroundColor Green

    # 从证书存储中删除临时证书
    Remove-Item "Cert:\LocalMachine\My\$($cert.Thumbprint)"

    Write-Host "`n🎉 证书生成完成!" -ForegroundColor Green
    Write-Host "证书文件: certs\server.crt" -ForegroundColor Cyan
    Write-Host "私钥文件: certs\server.pfx (密码: elontalk2024)" -ForegroundColor Cyan
    Write-Host "`n⚠️  注意: 这是自签名证书，浏览器会显示不安全警告" -ForegroundColor Yellow
    Write-Host "生产环境请使用 Let's Encrypt 申请真实证书" -ForegroundColor Yellow

} catch {
    Write-Host "❌ 证书生成失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "请以管理员身份运行 PowerShell" -ForegroundColor Yellow
}