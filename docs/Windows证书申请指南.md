# Windows系统申请Let's Encrypt证书指南

## 🎯 为什么在Windows申请证书？

根据您的服务器错误：
```
Timeout during connect (likely firewall problem)
```

Let's Encrypt无法访问您服务器的80端口验证域名，我们可以在Windows上使用DNS验证方式申请证书。

## 📋 准备信息

- **域名**: elontalk.duckdns.org
- **DuckDNS Token**: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca
- **服务器IP**: 43.139.82.12
- **邮箱**: siwmm@163.com

## 🔧 方法1: 使用 win-acme (推荐)

### 1. 下载 win-acme
```powershell
# 在PowerShell中运行
$url = "https://github.com/win-acme/win-acme/releases/latest/download/win-acme.v2.2.9.1701.x64.pluggable.zip"
Invoke-WebRequest -Uri $url -OutFile "win-acme.zip"
Expand-Archive -Path "win-acme.zip" -DestinationPath "win-acme"
cd win-acme
```

### 2. 运行证书申请
```powershell
# 使用DNS验证申请证书
.\wacs.exe --target manual --host elontalk.duckdns.org --validation dnsscript --dnsscript "dns-duckdns.ps1" --emailaddress siwmm@163.com
```

## 🔧 方法2: 使用 Certbot for Windows

### 1. 安装 Certbot
```powershell
# 使用 Chocolatey 安装
choco install certbot

# 或者下载独立版本
# https://dl.eff.org/certbot-beta-installer-win_amd64_signed.exe
```

### 2. 使用手动DNS验证
```powershell
certbot certonly --manual --preferred-challenges dns --email siwmm@163.com --agree-tos --no-eff-email -d elontalk.duckdns.org
```

按照提示添加DNS TXT记录到DuckDNS。

## 🔧 方法3: 使用DuckDNS脚本 (最简单)

我为您创建一个专门的脚本，利用DuckDNS的API直接验证。

### 脚本位置
`E:\duihua\customer-service-system\scripts\get-cert-windows.ps1`

### 运行方式
```powershell
cd E:\duihua\customer-service-system
.\scripts\get-cert-windows.ps1
```

## 📁 证书文件位置

申请成功后，证书文件通常在：
- **win-acme**: `C:\ProgramData\win-acme\certificates\`
- **Certbot**: `C:\Certbot\live\elontalk.duckdns.org\`

需要的文件：
- `fullchain.pem` → 重命名为 `server.crt`
- `privkey.pem` → 重命名为 `server.key`

## 🚀 部署到Ubuntu

1. 将证书文件复制到部署包：
```powershell
copy "fullchain.pem" "E:\duihua\customer-service-system\ubuntu-deploy-ready\certs\server.crt"
copy "privkey.pem" "E:\duihua\customer-service-system\ubuntu-deploy-ready\certs\server.key"
```

2. 重新上传部署包到Ubuntu服务器

3. 在Ubuntu上启动HTTPS服务：
```bash
cd /root/ubuntu-deploy-ready
chmod 644 certs/server.crt
chmod 600 certs/server.key
./customer-service-backend
```

## 🔍 验证证书

上传后在Ubuntu服务器验证：
```bash
openssl x509 -in /root/ubuntu-deploy-ready/certs/server.crt -text -noout | grep -E "Subject:|Issuer:|Not After"
```

## 📝 注意事项

1. **证书有效期**: Let's Encrypt证书有效期90天
2. **自动更新**: 部署后可以在服务器上设置自动更新
3. **权限设置**: 确保证书文件权限正确
4. **防火墙**: 确保Ubuntu服务器8443端口开放

这样可以绕过服务器防火墙问题，先在Windows上申请好证书再部署。