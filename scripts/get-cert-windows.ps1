# ELonTalk 客服系统 - Windows证书申请脚本
# 版本: 1.0
# 更新时间: 2025年10月14日
# 功能: 在Windows上申请Let's Encrypt证书并自动配置

param(
    [string]$Method = "certbot",
    [switch]$Help
)

# 彩色输出函数
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# 配置变量
$Domain = "elontalk.duckdns.org"
$DuckDNSToken = "400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"
$Email = "siwmm@163.com"
$ServerIP = "43.139.82.12"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CertsDir = Join-Path $ProjectRoot "ubuntu-deploy-ready\certs"

function Show-Help {
    @"
ELonTalk 客服系统 - Windows证书申请脚本
========================================

用法: .\get-cert-windows.ps1 [选项]

选项:
  -Method certbot     使用 Certbot 申请证书 (推荐)
  -Method winacme     使用 win-acme 申请证书
  -Method selfsigned  生成自签名证书 (测试用)
  -Help              显示此帮助信息

配置信息:
  域名: $Domain
  邮箱: $Email
  服务器IP: $ServerIP
  证书目录: $CertsDir

示例:
  .\get-cert-windows.ps1 -Method certbot
  .\get-cert-windows.ps1 -Method selfsigned

注意:
  1. 需要管理员权限运行
  2. 确保已安装 Chocolatey (用于安装依赖)
  3. 证书申请成功后会自动复制到部署目录
"@
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Chocolatey {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Info "安装 Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Success "Chocolatey 安装完成"
    } else {
        Write-Success "Chocolatey 已安装"
    }
}

function Install-Certbot {
    Write-Info "检查并安装 Certbot..."
    
    if (!(Get-Command certbot -ErrorAction SilentlyContinue)) {
        Write-Info "安装 Certbot..."
        choco install certbot -y
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        if (Get-Command certbot -ErrorAction SilentlyContinue) {
            Write-Success "Certbot 安装成功"
        } else {
            Write-Error "Certbot 安装失败"
            return $false
        }
    } else {
        Write-Success "Certbot 已安装"
        certbot --version
    }
    return $true
}

function Update-DuckDNS {
    Write-Info "更新 DuckDNS 域名解析..."
    
    try {
        $url = "https://www.duckdns.org/update?domains=elontalk&token=$DuckDNSToken&ip=$ServerIP"
        $response = Invoke-RestMethod -Uri $url -Method Get
        
        if ($response -eq "OK") {
            Write-Success "DuckDNS 更新成功: $Domain -> $ServerIP"
        } else {
            Write-Warning "DuckDNS 更新可能失败，响应: $response"
        }
        
        # 等待 DNS 传播
        Write-Info "等待 DNS 传播 (30秒)..."
        Start-Sleep -Seconds 30
        
        # 验证 DNS 解析
        try {
            $resolvedIP = [System.Net.Dns]::GetHostAddresses($Domain) | Select-Object -First 1
            if ($resolvedIP.IPAddressToString -eq $ServerIP) {
                Write-Success "DNS 解析验证成功: $Domain -> $($resolvedIP.IPAddressToString)"
            } else {
                Write-Warning "DNS 解析可能未完全传播: $Domain -> $($resolvedIP.IPAddressToString) (期望: $ServerIP)"
            }
        } catch {
            Write-Warning "DNS 解析验证失败: $($_.Exception.Message)"
        }
        
    } catch {
        Write-Error "DuckDNS 更新失败: $($_.Exception.Message)"
        return $false
    }
    return $true
}

function Request-CertbotCertificate {
    Write-Info "使用 Certbot 申请 Let's Encrypt 证书..."
    
    # 创建临时目录
    $tempDir = Join-Path $env:TEMP "letsencrypt-$Domain"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        Write-Info "使用手动 DNS 验证模式..."
        Write-Warning "注意: 需要手动添加 DNS TXT 记录！"
        
        # 使用 Certbot 手动 DNS 验证
        $certbotArgs = @(
            "certonly"
            "--manual"
            "--preferred-challenges", "dns"
            "--email", $Email
            "--agree-tos"
            "--no-eff-email"
            "--domains", $Domain
            "--work-dir", $tempDir
            "--config-dir", $tempDir
            "--logs-dir", $tempDir
        )
        
        Write-Info "运行 Certbot 命令..."
        Write-Info "请按照提示添加 DNS TXT 记录到 DuckDNS"
        
        & certbot @certbotArgs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Let's Encrypt 证书申请成功!"
            
            # 查找证书文件
            $livePath = Join-Path $tempDir "live\$Domain"
            $fullchainPath = Join-Path $livePath "fullchain.pem"
            $privkeyPath = Join-Path $livePath "privkey.pem"
            
            if ((Test-Path $fullchainPath) -and (Test-Path $privkeyPath)) {
                # 确保目标目录存在
                if (!(Test-Path $CertsDir)) {
                    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
                }
                
                # 复制证书文件
                Copy-Item $fullchainPath (Join-Path $CertsDir "server.crt")
                Copy-Item $privkeyPath (Join-Path $CertsDir "server.key")
                
                Write-Success "证书文件已复制到: $CertsDir"
                return $true
            } else {
                Write-Error "证书文件未找到在: $livePath"
                return $false
            }
        } else {
            Write-Error "Certbot 证书申请失败"
            return $false
        }
    } catch {
        Write-Error "证书申请过程出错: $($_.Exception.Message)"
        return $false
    }
}

function Generate-SelfSignedCert {
    Write-Info "生成自签名证书 (用于开发/测试)..."
    
    try {
        # 确保目标目录存在
        if (!(Test-Path $CertsDir)) {
            New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
        }
        
        $certPath = Join-Path $CertsDir "server.crt"
        $keyPath = Join-Path $CertsDir "server.key"
        
        # 检查是否有 OpenSSL
        if (Get-Command openssl -ErrorAction SilentlyContinue) {
            Write-Info "使用 OpenSSL 生成自签名证书..."
            
            & openssl req -x509 -newkey rsa:4096 -keyout $keyPath -out $certPath -days 365 -nodes -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/OU=IT/CN=$Domain"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "自签名证书生成成功"
                Write-Warning "注意: 自签名证书不被浏览器信任，仅用于测试环境"
                return $true
            }
        } else {
            Write-Info "OpenSSL 未找到，使用 PowerShell 生成证书..."
            
            # 使用 PowerShell 生成自签名证书
            $cert = New-SelfSignedCertificate -DnsName $Domain -CertStoreLocation "cert:\LocalMachine\My" -KeyLength 4096 -NotAfter (Get-Date).AddYears(1)
            
            # 导出证书
            $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
            [System.IO.File]::WriteAllBytes($certPath, $certBytes)
            
            # 导出私钥 (需要额外步骤)
            Write-Warning "PowerShell 方式无法直接导出私钥，建议安装 OpenSSL"
            Write-Info "可以通过以下方式安装 OpenSSL:"
            Write-Info "  choco install openssl"
            
            return $false
        }
    } catch {
        Write-Error "自签名证书生成失败: $($_.Exception.Message)"
        return $false
    }
}

function Verify-Certificate {
    Write-Info "验证证书..."
    
    $certPath = Join-Path $CertsDir "server.crt"
    $keyPath = Join-Path $CertsDir "server.key"
    
    if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
        Write-Success "证书文件存在"
        
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host "  证书信息" -ForegroundColor Cyan
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📁 证书文件位置:" -ForegroundColor Yellow
        Write-Host "   证书: $certPath" -ForegroundColor White
        Write-Host "   私钥: $keyPath" -ForegroundColor White
        Write-Host ""
        
        if (Get-Command openssl -ErrorAction SilentlyContinue) {
            Write-Host "📋 证书详情:" -ForegroundColor Yellow
            & openssl x509 -in $certPath -text -noout | Select-String "Subject:|Issuer:|Not Before|Not After"
        } else {
            Write-Host "📋 安装 OpenSSL 以查看详细证书信息:" -ForegroundColor Yellow
            Write-Host "   choco install openssl" -ForegroundColor White
        }
        
        Write-Host ""
        Write-Host "🚀 下一步:" -ForegroundColor Yellow
        Write-Host "   1. 上传整个 ubuntu-deploy-ready 文件夹到服务器" -ForegroundColor White
        Write-Host "   2. 在服务器上运行: cd /root/ubuntu-deploy-ready && ./customer-service-backend" -ForegroundColor White
        Write-Host "   3. 访问: https://$Domain" + ":8443" -ForegroundColor White
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Cyan
        
        return $true
    } else {
        Write-Error "证书文件不存在"
        return $false
    }
}

# 主函数
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    Write-Host "ELonTalk 客服系统 - Windows证书申请脚本" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 检查管理员权限
    if (!(Test-Administrator)) {
        Write-Error "请以管理员身份运行此脚本"
        return
    }
    
    Write-Info "当前方法: $Method"
    Write-Info "域名: $Domain"
    Write-Info "证书目录: $CertsDir"
    Write-Host ""
    
    switch ($Method.ToLower()) {
        "certbot" {
            Install-Chocolatey
            if (Install-Certbot) {
                Update-DuckDNS
                if (Request-CertbotCertificate) {
                    Verify-Certificate
                }
            }
        }
        "selfsigned" {
            if (Generate-SelfSignedCert) {
                Verify-Certificate
            }
        }
        default {
            Write-Error "未知的方法: $Method"
            Show-Help
        }
    }
}

# 运行主函数
Main