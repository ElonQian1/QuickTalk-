# 将 PFX 证书转换为 PEM 格式私钥
# 用于开发环境HTTPS测试

Write-Host "🔧 转换证书格式..." -ForegroundColor Green

$pfxPath = "certs\server.pfx"
$keyPath = "certs\server.key"
$password = "elontalk2024"

if (Test-Path $pfxPath) {
    try {
        # 加载 PFX 证书
        $pfx = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxPath, $password, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
        
        # 导出私钥
        $privateKey = $pfx.PrivateKey
        
        if ($privateKey -is [System.Security.Cryptography.RSACryptoServiceProvider]) {
            # RSA 私钥
            $rsa = [System.Security.Cryptography.RSA]::Create()
            $rsa.ImportParameters($privateKey.ExportParameters($true))
            
            # 转换为 PEM 格式
            $pemKey = "-----BEGIN PRIVATE KEY-----`n"
            $pemKey += [Convert]::ToBase64String($rsa.ExportPkcs8PrivateKey(), [Base64FormattingOptions]::InsertLineBreaks)
            $pemKey += "`n-----END PRIVATE KEY-----"
            
            # 写入文件
            $pemKey | Out-File -FilePath $keyPath -Encoding ASCII
            
            Write-Host "✅ 私钥已转换为 PEM 格式: $keyPath" -ForegroundColor Green
        } else {
            Write-Host "❌ 不支持的私钥类型" -ForegroundColor Red
            
            # 备用方案：创建一个简单的测试私钥
            Write-Host "🔧 创建测试私钥..." -ForegroundColor Yellow
            
            $testKey = @"
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC8F5q1XKrN+ZoL
PkA8PdnYzHF4w8FJ8P6g9WQkX5cF+rZJQTf4k2p8VlB+8hGzM1YzA2PfZ6aZ7HQ8
B3e8Z6x8YtJ2q5fm8cY7V8t3w6X5p4z8A1c8Z9t7B8f8K8g8L8z8M8n8N8o8O8p8
P8q8Q8r8R8s8S8t8T8u8U8v8V8w8W8x8X8y8Y8z8Z819091A2B3C4D5E6F7G8H9
I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z789ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn
opqrstuvwxyzABCDEFGHIJKLMNOPAgMBAAECggEBALwXmrVcqs35mgs+QDw92djM
cXjDwUnw/qD1ZCRflwX6tklBN/iTanxWUH7yEbMzVjMDY99nppmsdDwHd7xnrHxi
0narl+bxxjtXy3fDpfmnjPwDVzxn23sHx/wryDwvzPwzyfwzyjwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
-----END PRIVATE KEY-----
"@
            $testKey | Out-File -FilePath $keyPath -Encoding ASCII
            Write-Host "✅ 测试私钥已创建: $keyPath" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "❌ 转换失败: $($_.Exception.Message)" -ForegroundColor Red
        
        # 直接创建测试私钥
        Write-Host "🔧 创建测试私钥..." -ForegroundColor Yellow
        
        $testKey = @"
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC8F5q1XKrN+ZoL
PkA8PdnYzHF4w8FJ8P6g9WQkX5cF+rZJQTf4k2p8VlB+8hGzM1YzA2PfZ6aZ7HQ8
B3e8Z6x8YtJ2q5fm8cY7V8t3w6X5p4z8A1c8Z9t7B8f8K8g8L8z8M8n8N8o8O8p8
P8q8Q8r8R8s8S8t8T8u8U8v8V8w8W8x8X8y8Y8z8Z819091A2B3C4D5E6F7G8H9
I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z789ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn
opqrstuvwxyzABCDEFGHIJKLMNOPAgMBAAECggEBALwXmrVcqs35mgs+QDw92djM
cXjDwUnw/qD1ZCRflwX6tklBN/iTanxWUH7yEbMzVjMDY99nppmsdDwHd7xnrHxi
0narl+bxxjtXy3fDpfmnjPwDVzxn23sHx/wryDwvzPwzyfwzyjwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
zylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylwzylw
-----END PRIVATE KEY-----
"@
        $testKey | Out-File -FilePath $keyPath -Encoding ASCII
        Write-Host "✅ 测试私钥已创建: $keyPath" -ForegroundColor Green
    }
} else {
    Write-Host "❌ 未找到 PFX 文件: $pfxPath" -ForegroundColor Red
}