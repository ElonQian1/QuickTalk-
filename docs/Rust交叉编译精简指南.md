# Rust 交叉编译精简指南 - Windows 到 Ubuntu

> **目标**: 在 Windows 11 环境下交叉编译 Rust 项目到 Ubuntu 24.04 LTS  
> **结果**: 6MB 静态链接 Linux 二进制文件，零依赖部署  
> **验证时间**: 2025年10月10日  
> **编译时间**: ~14秒

## 🎯 核心问题与解决方案

**问题**: SQLx 的 `runtime-tokio-native-tls` 依赖 OpenSSL，无法交叉编译到 Linux  
**解决**: 移除 TLS 依赖，使用 bundled SQLite

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

### 步骤 2: 修改依赖配置 ⭐ **核心步骤**
编辑 `backend/Cargo.toml`：
```toml
# ❌ 删除这行（会导致 OpenSSL 交叉编译失败）
# sqlx = { version = "0.7", features = ["runtime-tokio-native-tls", "sqlite", "chrono", "uuid", "macros"] }

# ✅ 替换为最小化配置
sqlx = { version = "0.7", features = ["sqlite", "chrono", "uuid", "macros"], default-features = false }
libsqlite3-sys = { version = "0.27", features = ["bundled"] }
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
```powershell
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl
```

## ✅ 验证结果

编译成功后检查：
```powershell
dir target\x86_64-unknown-linux-musl\release\customer-service-backend
# 应该看到约 6MB 的二进制文件
```

在 Ubuntu 测试：
```bash
chmod +x customer-service-backend
./customer-service-backend
# 应启动在 http://0.0.0.0:8080
```

## 🚨 常见错误

### 错误：OpenSSL 相关错误
```
Could not find directory of OpenSSL installation
```
**解决**: 确保已移除 `runtime-tokio-native-tls` 依赖

### 错误：找不到工具
```
failed to find tool "x86_64-linux-musl-gcc"
```
**解决**: 使用 `cargo zigbuild` 而不是 `cargo build`

## 📊 性能数据

- **编译时间**: 约 14 秒（后续编译）
- **二进制大小**: 6MB
- **依赖**: 零系统依赖（静态链接）
- **兼容性**: Ubuntu 16.04+ (glibc 2.17+)

## 🎯 核心原理

1. **Zig**: 替代传统 GCC，提供完整的 C 交叉编译环境
2. **musl**: 静态链接 C 标准库，避免动态库依赖
3. **bundled SQLite**: 编译时内嵌 SQLite，无需系统安装
4. **去除 TLS**: 避免 OpenSSL 交叉编译复杂性

---

## 📋 完整命令总结

如果从零开始：
```powershell
# 1. 安装工具
rustup target add x86_64-unknown-linux-musl
winget install zig.zig  
cargo install cargo-zigbuild

# 2. 修改 Cargo.toml（见上方）

# 3. 创建 .cargo/config.toml（见上方）

# 4. 编译
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl
```

**总用时**: 约 2 分钟（不含下载时间）  
**核心步骤**: 只有 4 个！

---
*基于实际测试验证，去除所有非必要步骤*