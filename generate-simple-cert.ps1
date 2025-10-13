# 简化版证书生成脚本 - 使用.NET直接生成PEM格式
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

try {
    # 使用.NET生成RSA密钥对
    Add-Type -AssemblyName System.Security
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    
    # 生成证书请求
    $req = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest("CN=$Domain", $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    
    # 添加SAN扩展
    $sanBuilder = New-Object System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder
    $sanBuilder.AddDnsName($Domain)
    $sanBuilder.AddDnsName("127.0.0.1")
    $sanBuilder.AddIpAddress([System.Net.IPAddress]::Loopback)
    $req.CertificateExtensions.Add($sanBuilder.Build())
    
    # 生成自签名证书
    $cert = $req.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddYears(1))
    
    Write-Host "🔑 生成证书成功"
    
    # 导出证书为PEM格式
    $certPath = "$CertDir\server.crt"
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certBase64 = [Convert]::ToBase64String($certBytes)
    $certPem = "-----BEGIN CERTIFICATE-----`n"
    for ($i = 0; $i -lt $certBase64.Length; $i += 64) {
        $line = $certBase64.Substring($i, [Math]::Min(64, $certBase64.Length - $i))
        $certPem += "$line`n"
    }
    $certPem += "-----END CERTIFICATE-----"
    [System.IO.File]::WriteAllText($certPath, $certPem)
    
    Write-Host "📋 证书已保存: $certPath"
    
    # 导出私钥为PKCS#8 PEM格式
    $keyPath = "$CertDir\server.key"
    $privateKeyBytes = $rsa.ExportPkcs8PrivateKey()
    $privateKeyBase64 = [Convert]::ToBase64String($privateKeyBytes)
    $keyPem = "-----BEGIN PRIVATE KEY-----`n"
    for ($i = 0; $i -lt $privateKeyBase64.Length; $i += 64) {
        $line = $privateKeyBase64.Substring($i, [Math]::Min(64, $privateKeyBase64.Length - $i))
        $keyPem += "$line`n"
    }
    $keyPem += "-----END PRIVATE KEY-----"
    [System.IO.File]::WriteAllText($keyPath, $keyPem)
    
    Write-Host "🔑 私钥已保存: $keyPath"
    
    # 显示文件信息
    $certInfo = Get-Item $certPath
    $keyInfo = Get-Item $keyPath
    
    Write-Host "✅ 证书生成完成！"
    Write-Host "📋 证书文件: $certPath ($($certInfo.Length) bytes)"
    Write-Host "🔑 私钥文件: $keyPath ($($keyInfo.Length) bytes)"
    Write-Host "🌐 域名: $Domain"
    Write-Host "⏰ 有效期: 1年"
    
    # 验证文件内容
    $certContent = Get-Content $certPath -Raw
    $keyContent = Get-Content $keyPath -Raw
    
    if ($certContent -match "BEGIN CERTIFICATE" -and $keyContent -match "BEGIN PRIVATE KEY") {
        Write-Host "✅ 证书格式验证通过"
    } else {
        Write-Host "❌ 证书格式验证失败"
    }
    
} catch {
    Write-Error "❌ 证书生成失败: $($_.Exception.Message)"
} finally {
    if ($rsa) { $rsa.Dispose() }
}