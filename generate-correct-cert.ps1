# 生成正确格式的开发证书
param(
    [string]$CertDir = "certs",
    [string]$Domain = "localhost"
)

# 确保证书目录存在
if (!(Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir -Force
    Write-Host "✅ 创建证书目录: $CertDir"
}

# 删除旧证书
Remove-Item -Path "$CertDir\server.*" -Force -ErrorAction SilentlyContinue
Write-Host "🗑️  清理旧证书文件"

# 生成新的自签名证书
$cert = New-SelfSignedCertificate `
    -Subject "CN=$Domain" `
    -DnsName $Domain, "127.0.0.1", "::1" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -NotAfter (Get-Date).AddYears(1) `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyUsage DigitalSignature, KeyEncipherment

Write-Host "🔑 生成证书，指纹: $($cert.Thumbprint)"

# 导出证书为Base64编码的CRT文件
$certPath = "$CertDir\server.crt"
$certBase64 = [Convert]::ToBase64String($cert.RawData)
$certPem = "-----BEGIN CERTIFICATE-----`n"
for ($i = 0; $i -lt $certBase64.Length; $i += 64) {
    $line = $certBase64.Substring($i, [Math]::Min(64, $certBase64.Length - $i))
    $certPem += "$line`n"
}
$certPem += "-----END CERTIFICATE-----"
$certPem | Out-File -FilePath $certPath -Encoding UTF8 -NoNewline

Write-Host "📋 证书已保存: $certPath"

# 导出私钥为PKCS#8 PEM格式
$keyPath = "$CertDir\server.key"
$tempPfxPath = "$CertDir\temp.pfx"

# 导出为PFX (包含私钥)
$pfxPassword = ConvertTo-SecureString -String "temp123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $tempPfxPath -Password $pfxPassword | Out-Null

# 使用.NET加载PFX并提取私钥
$pfx = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($tempPfxPath, "temp123", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
$rsa = $pfx.PrivateKey -as [System.Security.Cryptography.RSACryptoServiceProvider]

if ($rsa) {
    # 导出为PKCS#8格式
    $privateKeyInfo = $rsa.ExportRSAPrivateKey()
    $privateKeyBase64 = [Convert]::ToBase64String($privateKeyInfo)
    
    $keyPem = "-----BEGIN PRIVATE KEY-----`n"
    for ($i = 0; $i -lt $privateKeyBase64.Length; $i += 64) {
        $line = $privateKeyBase64.Substring($i, [Math]::Min(64, $privateKeyBase64.Length - $i))
        $keyPem += "$line`n"
    }
    $keyPem += "-----END PRIVATE KEY-----"
    
    $keyPem | Out-File -FilePath $keyPath -Encoding UTF8 -NoNewline
    Write-Host "🔑 私钥已保存: $keyPath"
} else {
    Write-Error "❌ 无法提取私钥"
}

# 清理临时文件
Remove-Item $tempPfxPath -Force -ErrorAction SilentlyContinue

# 从证书存储中删除证书
Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host "✅ 证书生成完成！"
Write-Host "📋 证书文件: $certPath ($(Get-Item $certPath | Select-Object -ExpandProperty Length) bytes)"
Write-Host "🔑 私钥文件: $keyPath ($(Get-Item $keyPath | Select-Object -ExpandProperty Length) bytes)"