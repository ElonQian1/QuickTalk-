# ACME 双验证方式集成指南

## 📋 概述

本系统支持两种 ACME 证书验证方式：
- **DNS-01**: 通过 DNS TXT 记录验证域名所有权（推荐用于服务器没有 80 端口或使用通配符证书）
- **HTTP-01**: 通过 HTTP 服务器在 80 端口提供验证文件（最常用，最简单）

## 🏗️ 架构说明

```
backend/src/tls/acme/
├── mod.rs                    # ACME 配置和统一入口
├── client.rs                 # DNS-01 ACME 客户端
├── http_client.rs            # HTTP-01 ACME 客户端
├── expiry.rs                 # 证书过期检查
├── providers/
│   ├── mod.rs                # DNS 提供商接口
│   └── duckdns.rs            # DuckDNS DNS-01 提供商
└── http_challenge/
    ├── mod.rs                # HTTP-01 挑战接口
    ├── server.rs             # HTTP 挑战服务器（80端口）
    └── storage.rs            # 挑战 token 内存存储
```

## ⚙️ 环境变量配置

### 通用配置

```bash
# ACME 基础配置
ACME_ENABLED=true                                           # 启用 ACME 自动证书
ACME_EMAIL=your-email@example.com                           # Let's Encrypt 账户邮箱
ACME_DOMAINS=elontalk.duckdns.org                          # 证书域名（逗号分隔）
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory  # ACME 服务器
RENEW_BEFORE_DAYS=30                                        # 提前多少天续期
```

### 方式 1: DNS-01 验证（推荐）

```bash
# 使用 DNS-01 验证
ACME_CHALLENGE=dns-01

# DuckDNS 配置
DUCKDNS_DOMAIN=elontalk                                     # DuckDNS 域名（不含 .duckdns.org）
DUCKDNS_TOKEN=your-duckdns-token-here                       # DuckDNS API Token
```

**优势：**
- ✅ 不需要 80 端口
- ✅ 支持通配符证书（*.example.com）
- ✅ 适合防火墙限制场景

**劣势：**
- ⚠️ 需要 DNS 传播时间（120-150秒）
- ⚠️ 依赖 DNS 提供商 API

### 方式 2: HTTP-01 验证

```bash
# 使用 HTTP-01 验证
ACME_CHALLENGE=http-01
```

**优势：**
- ✅ 最简单、最快速
- ✅ Let's Encrypt 推荐方式
- ✅ 验证时间短（5-10秒）

**劣势：**
- ⚠️ 需要 80 端口可访问
- ⚠️ 不支持通配符证书

## 📝 代码集成示例

### 示例 1: DNS-01 方式（纯后台运行）

```rust
use customer_service_backend::tls::acme::{AcmeClient, AcmeConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 加载配置
    let acme_config = AcmeConfig::from_env();
    
    // 确保证书存在且有效（DNS-01 不需要额外参数）
    let renewed = AcmeClient::ensure(&acme_config, None).await?;
    
    if renewed {
        println!("✅ 证书已更新");
    }
    
    // 启动 HTTPS 服务器...
    Ok(())
}
```

### 示例 2: HTTP-01 方式（需要启动 80 端口服务）

```rust
use customer_service_backend::tls::acme::{
    AcmeClient, AcmeConfig, HttpChallengeServer, ChallengeStorage
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. 创建挑战存储
    let challenge_storage = ChallengeStorage::new();
    
    // 2. 启动 HTTP-01 挑战服务器（后台运行）
    let http_server = HttpChallengeServer::new(challenge_storage.clone(), 80);
    let server_handle = http_server.start_background();
    
    // 3. 加载 ACME 配置
    let acme_config = AcmeConfig::from_env();
    
    // 4. 确保证书存在且有效（传入 storage）
    let renewed = AcmeClient::ensure(&acme_config, Some(challenge_storage)).await?;
    
    if renewed {
        println!("✅ 证书已更新");
    }
    
    // 5. 启动 HTTPS 服务器（8443端口）...
    
    // 6. 保持 HTTP 服务器运行（用于未来的续期）
    server_handle.await??;
    
    Ok(())
}
```

### 示例 3: 同时支持两种方式（完整集成）

```rust
use customer_service_backend::tls::acme::{
    AcmeClient, AcmeConfig, HttpChallengeServer, ChallengeStorage
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 加载配置
    let acme_config = AcmeConfig::from_env();
    
    // 根据配置决定是否启动 HTTP 服务器
    let (challenge_storage, http_server_handle) = if acme_config.challenge == "http-01" {
        let storage = ChallengeStorage::new();
        let server = HttpChallengeServer::new(storage.clone(), 80);
        let handle = server.start_background();
        (Some(storage), Some(handle))
    } else {
        (None, None)
    };
    
    // 确保证书（自动选择验证方式）
    let renewed = AcmeClient::ensure(&acme_config, challenge_storage).await?;
    
    if renewed {
        tracing::info!("✅ 证书已更新");
    }
    
    // 启动主服务器...
    
    // 如果有 HTTP 服务器，保持运行
    if let Some(handle) = http_server_handle {
        handle.await??;
    }
    
    Ok(())
}
```

## 🚀 测试步骤

### 测试 DNS-01

```bash
# 1. 配置环境变量
export ACME_ENABLED=true
export ACME_EMAIL=your@email.com
export ACME_DOMAINS=elontalk.duckdns.org
export ACME_CHALLENGE=dns-01
export DUCKDNS_DOMAIN=elontalk
export DUCKDNS_TOKEN=your-token

# 2. 运行后端
./customer-service-backend

# 3. 观察日志
# 应该看到：
# - 🔐 ACME 证书检查启动
# - 🌐 使用 DNS-01 验证方式
# - 📝 创建 ACME 账户
# - 设置 TXT 记录
# - ⏳ 等待 DNS 传播 (120秒)
# - ✅ ACME 证书签发成功
```

### 测试 HTTP-01

```bash
# 1. 配置环境变量
export ACME_ENABLED=true
export ACME_EMAIL=your@email.com
export ACME_DOMAINS=elontalk.duckdns.org
export ACME_CHALLENGE=http-01

# 2. 运行后端
./customer-service-backend

# 3. 观察日志
# 应该看到：
# - 🌐 HTTP-01 挑战服务器启动在: 0.0.0.0:80
# - 🔐 ACME 证书检查启动
# - 🌐 使用 HTTP-01 验证方式
# - ✅ HTTP-01 挑战已准备
# - ✅ ACME HTTP-01 证书签发成功

# 4. 验证 HTTP 服务器（另一个终端）
curl http://elontalk.duckdns.org/.well-known/acme-challenge/test
# 应该返回 404（因为没有实际挑战）
```

## 🔄 自动续期

两种方式都支持自动续期：

```rust
// 定期检查并续期
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(86400)); // 每天检查一次
    loop {
        interval.tick().await;
        
        match AcmeClient::ensure(&acme_config, challenge_storage.clone()).await {
            Ok(renewed) if renewed => {
                tracing::info!("✅ 证书自动续期成功");
                // 重新加载证书到 HTTPS 服务器...
            }
            Ok(_) => {
                tracing::debug!("证书仍然有效，无需续期");
            }
            Err(e) => {
                tracing::error!("❌ 证书续期失败: {}", e);
            }
        }
    }
});
```

## 🎯 选择建议

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 服务器有 80 端口 | **HTTP-01** | 最简单、最快速 |
| 服务器没有 80 端口 | **DNS-01** | 不需要 80 端口 |
| 需要通配符证书 | **DNS-01** | HTTP-01 不支持 |
| 防火墙限制 80 端口 | **DNS-01** | 绕过防火墙限制 |
| 首次测试 | **DNS-01** | 你的诊断显示 DNS 已就绪 |

## 📊 当前状态

根据你的服务器诊断：
- ✅ **DNS-01 就绪**：TXT 记录已传播，Let's Encrypt 可达
- ❌ **HTTP-01 未就绪**：80 端口无服务监听

**建议：先用 DNS-01 拿到证书，稳定后再测试 HTTP-01**

## 🐛 故障排除

### DNS-01 常见问题

1. **TXT 记录未传播**
   ```bash
   dig _acme-challenge.elontalk.duckdns.org TXT +short
   ```
   
2. **DuckDNS Token 错误**
   ```bash
   curl "https://www.duckdns.org/update?domains=elontalk&token=YOUR_TOKEN&txt=test"
   # 应该返回 OK
   ```

3. **并发冲突**
   - 不要同时做腾讯云 DNS 验证和 ACME DNS-01
   - DuckDNS 只有一条 TXT 记录位

### HTTP-01 常见问题

1. **80 端口被占用**
   ```bash
   ss -ltnp '( sport = :80 )'
   ```

2. **防火墙阻止**
   ```bash
   sudo ufw allow 80/tcp
   ```

3. **HTTP 服务器未启动**
   - 检查日志是否有 "HTTP-01 挑战服务器启动"

## 🔐 安全建议

1. **生产环境**：使用 `https://acme-v02.api.letsencrypt.org/directory`
2. **测试环境**：使用 `https://acme-staging-v02.api.letsencrypt.org/directory`
3. **私钥权限**：自动设置为 0600（仅所有者可读）
4. **证书权限**：自动设置为 0644（所有人可读）
5. **Token 安全**：不要在日志中暴露完整 token

## 📚 相关文档

- [Let's Encrypt 文档](https://letsencrypt.org/docs/)
- [ACME 协议规范](https://datatracker.ietf.org/doc/html/rfc8555)
- [DuckDNS API](https://www.duckdns.org/spec.jsp)
