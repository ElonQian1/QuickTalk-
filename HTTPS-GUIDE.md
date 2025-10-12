# HTTPS模块使用指南

## 📋 概述

本项目已成功集成独立的HTTPS模块，支持可选的HTTPS功能。通过Cargo特性标志(feature flags)控制，确保在不需要HTTPS时不会增加编译复杂度。

## 🏗️ 架构设计

### 模块结构
```
backend/src/
├── tls/                    # TLS/HTTPS 核心模块
│   ├── mod.rs             # 模块入口和版本信息
│   ├── config.rs          # TLS配置管理
│   └── cert_manager.rs    # 证书管理
├── server/                # 服务器模块
│   ├── mod.rs             # 服务器配置和重定向
│   └── https.rs           # HTTPS服务器实现
└── main.rs                # 主程序(已集成HTTPS逻辑)
```

### 特性标志
- `default = []`: 默认不启用HTTPS
- `https = ["rustls-pemfile", "axum-server"]`: 启用HTTPS功能

## 🚀 使用方法

### 1. HTTP模式(默认)
```bash
# 编译和运行(仅HTTP)
cargo build
cargo run

# 或使用现有脚本
npm run dev
```

### 2. HTTPS模式
```bash
# 编译带HTTPS功能
cargo build --features https

# 运行带HTTPS功能
cargo run --features https
```

### 3. 环境变量配置

创建 `.env` 文件：
```env
# 基本配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=your-super-secret-jwt-key
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS配置
HTTPS_ENABLED=true
HTTPS_PORT=8443
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
TLS_DOMAIN=localhost
REDIRECT_HTTP=true
```

## 🔐 证书配置

### 开发环境(自签名证书)

1. 创建证书目录：
```bash
mkdir certs
```

2. 生成自签名证书：
```bash
# Windows (使用OpenSSL或创建.bat脚本)
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/CN=localhost"

# 或使用PowerShell脚本(如果有证书生成工具)
```

### 生产环境

1. 使用Let's Encrypt获取免费SSL证书
2. 或购买商业SSL证书
3. 将证书文件放置在指定路径

## 📡 服务器行为

### HTTP模式
- 监听端口：8080 (或环境变量指定)
- 协议：HTTP
- WebSocket：ws://localhost:8080/ws/...

### HTTPS模式
- 监听端口：8443 (或环境变量指定)
- 协议：HTTPS
- WebSocket：wss://localhost:8443/ws/...
- 可选HTTP重定向：80 → 443

## 🛠️ 开发流程

### 1. 日常开发(HTTP)
```bash
# 快速启动开发环境
npm run dev
# 等价于 cargo run (默认HTTP模式)
```

### 2. HTTPS测试
```bash
# 启用HTTPS功能编译
cargo build --features https

# 配置环境变量(在.env中)
HTTPS_ENABLED=true

# 生成测试证书
mkdir certs
# 生成自签名证书...

# 运行HTTPS服务器
cargo run --features https
```

## 🔍 故障排除

### 编译问题
```bash
# 检查基础编译
cargo check

# 检查HTTPS功能编译
cargo check --features https

# 清理并重新编译
cargo clean
cargo build --features https
```

### 常见错误

1. **证书文件不存在**
   - 确保证书路径正确
   - 生成自签名证书用于测试

2. **端口占用**
   - 检查端口8080/8443是否被占用
   - 修改环境变量中的端口配置

3. **编译依赖问题**
   - 确保Rust工具链最新
   - 删除Cargo.lock重新生成依赖

## 📋 功能状态

### ✅ 已实现
- [x] 模块化TLS配置管理
- [x] 可选HTTPS编译特性
- [x] 基础HTTPS服务器框架
- [x] 环境变量配置系统
- [x] 证书验证逻辑
- [x] 服务器配置打印
- [x] 跨平台兼容性(Rustls)

### 🚧 下一步计划
- [ ] HTTP到HTTPS自动重定向
- [ ] Let's Encrypt自动证书申请
- [ ] 证书自动续期
- [ ] HTTPS性能优化
- [ ] 安全headers添加

## 💡 技术选择说明

### 为什么选择Rustls？
- **纯Rust实现**：避免OpenSSL跨编译复杂性
- **内存安全**：符合Rust安全理念
- **性能优异**：现代TLS实现
- **维护活跃**：生态成熟稳定

### 为什么使用特性标志？
- **可选依赖**：不强制所有用户安装TLS依赖
- **编译灵活性**：开发时可选择不同模式
- **部署简化**：生产环境可根据需要选择

## 🔧 自定义配置

### 扩展TLS配置
在 `tls/config.rs` 中添加新的配置选项：
```rust
pub struct TlsConfig {
    // 现有字段...
    pub custom_field: String,
}
```

### 添加HTTPS中间件
在 `server/https.rs` 中扩展中间件：
```rust
// 添加安全headers、日志等
```

---

**总结**：HTTPS模块已成功集成，提供了灵活的可选HTTPS支持。开发者可以根据需要选择HTTP或HTTPS模式，生产环境可配置完整的TLS支持。