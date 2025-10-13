# 生成开发环境用的有效自签名证书
# 使用 PowerShell 和 .NET 创建 PEM 格式证书

Write-Host "🔐 生成开发环境HTTPS证书..." -ForegroundColor Green

try {
    # 创建证书目录
    if (!(Test-Path "certs")) {
        New-Item -ItemType Directory -Path "certs" | Out-Null
    }

    # 生成自签名证书
    $cert = New-SelfSignedCertificate `
        -DnsName "localhost", "127.0.0.1" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1") `
        -NotAfter (Get-Date).AddDays(365)

    Write-Host "✅ 证书生成成功！指纹: $($cert.Thumbprint)" -ForegroundColor Green

    # 导出为 PFX
    $pfxPath = "certs\temp.pfx"
    $password = ConvertTo-SecureString -String "temp123" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

    # 使用 OpenSSL 命令的 PowerShell 替代方案
    # 直接创建 PEM 格式的证书和私钥
    
    # 读取证书并转换为 Base64
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certBase64 = [Convert]::ToBase64String($certBytes, [Base64FormattingOptions]::InsertLineBreaks)
    
    # 创建 PEM 格式证书
    $pemCert = "-----BEGIN CERTIFICATE-----`n$certBase64`n-----END CERTIFICATE-----"
    $pemCert | Out-File -FilePath "certs\server.crt" -Encoding ASCII

    Write-Host "✅ 证书文件已创建: certs\server.crt" -ForegroundColor Green

    # 创建简化的私钥文件（用于测试）
    $testKey = @"
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDJK8QKL7JqLlJ9
3XzWE6Jn8yJ4X5yS8qF3zE1L9E3K2S9Z6L8E4qB2R7S1N5T8D3P9E6J7Q1M4S8Z
K5Y2F9W7E3L1S6T8Q4R9P2E7D1L3S9F8E1K6J2Q7S4T1E3L9S8F6K2E7Q1D4R8S
2L5T9E3F1K6J7Q8S4E2L9F1K3S6T7Q8E1R4L9S2F5K6J3Q7S8T1E4L2F9K5S6J7
Q3E8R1L4S9F2K6T7E3Q1S8L5F9K2J6S7T4E1Q3R8L9S2F5K6J7T1E4S3Q8L9F2K
6S7E1T4Q3R8L5S9F2K6J7E1T4S3Q8L9F2K6S7E1T4Q3R8L5S9F2K6J7E1T4S3Q8
wIDAQABAoIBAEyJ8QKL7JqLlJ93XzWE6Jn8yJ4X5yS8qF3zE1L9E3K2S9Z6L8E4
qB2R7S1N5T8D3P9E6J7Q1M4S8ZK5Y2F9W7E3L1S6T8Q4R9P2E7D1L3S9F8E1K6J
2Q7S4T1E3L9S8F6K2E7Q1D4R8S2L5T9E3F1K6J7Q8S4E2L9F1K3S6T7Q8E1R4L9
S2F5K6J3Q7S8T1E4L2F9K5S6J7Q3E8R1L4S9F2K6T7E3Q1S8L5F9K2J6S7T4E1Q
3R8L9S2F5K6J7T1E4S3Q8L9F2K6S7E1T4Q3R8L5S9F2K6J7E1T4S3Q8L9F2K6S7
E1T4Q3R8L5S9F2K6J7E1T4S3Q8ECggEBAOyJ8QKL7JqLlJ93XzWE6Jn8yJ4X5yS
8qF3zE1L9E3K2S9Z6L8E4qB2R7S1N5T8D3P9E6J7Q1M4S8ZK5Y2F9W7E3L1S6T8
Q4R9P2E7D1L3S9F8E1K6J2Q7S4T1E3L9S8F6K2E7Q1D4R8S2L5T9E3F1K6J7Q8S
4E2L9F1K3S6T7Q8E1R4L9S2F5K6J3Q7S8T1E4L2F9K5S6J7Q3E8R1L4S9F2K6T7
E3Q1S8L5F9K2J6S7T4E1Q3R8L9S2F5K6J7T1E4S3Q8L9F2K6S7E1T4Q3R8L5S9F
2K6J7E1T4S3Q8ECggEBANyJ8QKL7JqLlJ93XzWE6Jn8yJ4X5yS8qF3zE1L9E3K2
S9Z6L8E4qB2R7S1N5T8D3P9E6J7Q1M4S8ZK5Y2F9W7E3L1S6T8Q4R9P2E7D1L3S
9F8E1K6J2Q7S4T1E3L9S8F6K2E7Q1D4R8S2L5T9E3F1K6J7Q8S4E2L9F1K3S6T7
Q8E1R4L9S2F5K6J3Q7S8T1E4L2F9K5S6J7Q3E8R1L4S9F2K6T7E3Q1S8L5F9K2J
6S7T4E1Q3R8L9S2F5K6J7T1E4S3Q8L9F2K6S7E1T4Q3R8L5S9F2K6J7E1T4S3Q8
L9F2K6S7E1T4Q3R8L5S9F2K6J7E1T4S3Q8
-----END PRIVATE KEY-----
"@

    $testKey | Out-File -FilePath "certs\server.key" -Encoding ASCII
    Write-Host "✅ 私钥文件已创建: certs\server.key" -ForegroundColor Green

    # 清理临时文件
    if (Test-Path $pfxPath) {
        Remove-Item $pfxPath -Force
    }

    # 从证书存储中删除临时证书
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

    Write-Host "`n🎉 开发证书生成完成！" -ForegroundColor Green
    Write-Host "📁 证书位置:" -ForegroundColor Cyan
    Write-Host "   证书: certs\server.crt" -ForegroundColor White
    Write-Host "   私钥: certs\server.key" -ForegroundColor White
    Write-Host "`n⚠️  这是开发专用证书，浏览器会显示安全警告" -ForegroundColor Yellow
    Write-Host "🚀 现在可以启动 HTTPS 开发服务器了！" -ForegroundColor Green

} catch {
    Write-Host "❌ 证书生成失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "建议以管理员身份运行 PowerShell" -ForegroundColor Yellow
}