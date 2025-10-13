# Rust 交叉编译精简指南 - Windows 到 Ubuntu (包含HTTPS)

> **目标**: 在 Windows 11 环境下交叉编译 Rust 项目到 Ubuntu 24.04 LTS  
> **结果**: 8.3MB 静态链接 Linux 二进制文件，零依赖部署，支持HTTPS  
> **验证时间**: 2025年10月13日  
> **编译时间**: ~12秒 (HTTPS版本)

## 🎯 核心问题与解决方案

**问题**: HTTPS功能通常依赖 OpenSSL，无法轻松交叉编译到 Linux  
**解决**: 使用 Rustls (纯Rust TLS实现) + Zig交叉编译器

## ⚡ 最精简步骤

### 前置条件检查
```powershell
# 检查是否已安装必要工具
rustup target list --installed | findstr linux-musl
zig version
cargo zigbuild --version
```

### 步骤 1: 安装工具（如果缺失）
```powershell
# 只有缺失时才需要安装
rustup target add x86_64-unknown-linux-musl
winget install zig.zig
cargo install cargo-zigbuild
```

### 步骤 2: 验证依赖配置 ⭐ **核心配置**
确认 `backend/Cargo.toml` 使用正确的依赖：

```toml
# ✅ 使用 Rustls 而非 OpenSSL (避免交叉编译问题)
sqlx = { version = "0.7", features = ["sqlite", "chrono", "uuid", "macros", "runtime-tokio-rustls"], default-features = false }
libsqlite3-sys = { version = "0.27", features = ["bundled"] }
tokio-rustls = "0.24"
rustls = "0.21"

# ✅ HTTPS 可选依赖 (使用 Rustls)
rustls-pemfile = { version = "1.0", optional = true }
axum-server = { version = "0.6", features = ["tls-rustls"], optional = true }

[features]
default = []
https = ["rustls-pemfile", "axum-server"]
```

### 步骤 3: 配置交叉编译器
创建或编辑 `backend/.cargo/config.toml`：
```toml
[build]
target = "x86_64-pc-windows-gnu"

[target.x86_64-pc-windows-gnu]
linker = "x86_64-w64-mingw32-gcc"

# Linux musl 目标配置
[target.x86_64-unknown-linux-musl]
linker = "rust-lld"
```

### 步骤 4: 执行交叉编译

#### 编译基础版本 (仅HTTP)
```powershell
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl
```

#### 编译HTTPS版本 ⭐ **推荐**
```powershell
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
```

## ✅ 验证结果

编译成功后检查：
```powershell
Get-ChildItem target\x86_64-unknown-linux-musl\release\customer-service-backend
# 应该看到约 8.3MB 的二进制文件
```

在 Ubuntu 测试：
```bash
chmod +x customer-service-backend
./customer-service-backend
# HTTP模式: 启动在 http://0.0.0.0:8080
# HTTPS模式: 启动在 https://0.0.0.0:8443 (需要证书文件)
```

## � HTTPS 部署注意事项

### 证书文件
HTTPS版本需要证书文件：
```bash
# 目录结构
├── customer-service-backend  # 编译好的二进制文件
├── certs/
│   ├── server.crt           # SSL证书
│   └── server.key           # 私钥
└── .env                     # 环境配置
```

### 环境配置示例
```env
# HTTPS配置
HTTPS_ENABLED=true
HTTPS_PORT=8443
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
TLS_DOMAIN=yourdomain.com
REDIRECT_HTTP=true
```

## 🚨 常见错误与解决方案

### 错误：Ring编译失败
```
error: failed to run custom build command for `ring v0.17.14`
```
**解决**: 使用 `cargo zigbuild` 而不是 `cargo build` 或 `cargo check`

### 错误：找不到工具
```
failed to find tool "x86_64-linux-musl-gcc"
```
**解决**: 确保使用 `cargo zigbuild` 命令

### 错误：证书相关
生产环境HTTPS需要有效证书，建议使用 Let's Encrypt。

## 📊 性能数据

| 版本 | 编译时间 | 二进制大小 | 功能 |
|------|----------|------------|------|
| HTTP版本 | ~8秒 | 6MB | 基础功能 |
| HTTPS版本 | ~12秒 | 8.3MB | 完整HTTPS支持 |

- **依赖**: 零系统依赖（静态链接）
- **兼容性**: Ubuntu 16.04+ (glibc 2.17+)
- **TLS实现**: Rustls (纯Rust，内存安全)

## 🎯 核心原理

1. **Zig**: 替代传统 GCC，提供完整的 C 交叉编译环境
2. **musl**: 静态链接 C 标准库，避免动态库依赖
3. **bundled SQLite**: 编译时内嵌 SQLite，无需系统安装
4. **Rustls**: 纯Rust TLS实现，避免 OpenSSL 交叉编译复杂性

---

## 📋 完整命令总结

### 从零开始设置：
```powershell
# 1. 安装工具
rustup target add x86_64-unknown-linux-musl
winget install zig.zig  
cargo install cargo-zigbuild

# 2. 确认 Cargo.toml 配置正确（已配置）

# 3. 创建 .cargo/config.toml（如果需要）

# 4. 编译 HTTP 版本
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl

# 5. 编译 HTTPS 版本（推荐）
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
```

### 生产部署：
```bash
# Ubuntu 服务器上
chmod +x customer-service-backend

# HTTP 模式（端口 8080）
HTTPS_ENABLED=false ./customer-service-backend

# HTTPS 模式（端口 8443，需要证书）
HTTPS_ENABLED=true TLS_CERT_PATH=certs/server.crt TLS_KEY_PATH=certs/server.key ./customer-service-backend
```

**总用时**: 约 2 分钟（不含下载时间）  
**核心优势**: 支持完整HTTPS功能，零依赖部署！

---
*最新验证时间：2025年10月13日 - HTTPS功能交叉编译测试通过*