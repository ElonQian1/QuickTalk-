# 证书目录说明

## 📋 证书文件配置

此目录用于存放HTTPS/TLS证书文件。

### 🔐 Let's Encrypt 证书 (推荐)

如果使用 Let's Encrypt 自动证书，请在 `.env` 文件中配置：

```bash
TLS_CERT_PATH=/etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem
```

### 🔑 自签名证书 (测试用)

如果使用自签名证书，请将证书文件放置在此目录：

```
certs/
├── server.crt    # SSL证书文件
└── server.key    # 私钥文件
```

然后在 `.env` 文件中配置：

```bash
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
```

### 🛠️ 生成自签名证书

如果需要生成自签名证书用于测试：

```bash
# 在此目录下执行
openssl req -x509 -newkey rsa:4096 \
  -keyout server.key \
  -out server.crt \
  -days 365 \
  -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=elontalk.duckdns.org"
```

### ⚠️ 安全提醒

- 生产环境请使用有效的SSL证书 (Let's Encrypt 或商业证书)
- 自签名证书仅适用于测试环境
- 私钥文件 (*.key) 权限应设置为 600: `chmod 600 server.key`
- 不要将私钥文件提交到版本控制系统