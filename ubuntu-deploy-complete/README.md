# ELonTalk 完整部署包

## 概述

此部署包包含了 ELonTalk 客服系统的完整部署所需的所有文件和脚本，旨在解决之前部署过程中遇到的各种问题，并提供完整的生产环境部署解决方案。

## 🚀 快速开始

### 1. 基本部署
```bash
# 1. 解压部署包到目标目录
cd /opt/elontalk

# 2. 设置权限
chmod +x *.sh

# 3. 启动服务
./start.sh
```

### 2. 完整部署 (推荐)
```bash
# 1. 运行部署脚本
./deploy.sh

# 2. 安装systemd服务 (可选)
./install-systemd.sh

# 3. 验证部署
./verify-deployment.sh
```

## 📁 文件结构

```
ubuntu-deploy-complete/
├── README.md                    # 本文件
├── .env.example                # 环境配置示例
├── elontalk.service            # Systemd 服务文件
│
├── customer-service-backend    # 主程序 (需要编译后复制)
├── static/                     # 前端静态文件 (需要构建后复制)
│
├── 🚀 启动脚本
├── start.sh                    # 智能启动脚本 (推荐)
├── stop.sh                     # 停止服务
├── restart.sh                  # 重启服务
├── status.sh                   # 查看状态
│
├── 🔧 管理工具
├── deploy.sh                   # 一键部署脚本
├── install-systemd.sh          # 安装系统服务
├── backup.sh                   # 数据备份
├── restore.sh                  # 数据恢复
├── update.sh                   # 更新部署
│
├── 🗄️ 数据库工具
├── check-database.sh           # 数据库检查
├── fix-database.sh             # 数据库修复
├── backup-database.sh          # 数据库备份
├── migrate-database.sh         # 数据库迁移
│
├── 🔐 SSL工具
├── setup-ssl.sh               # SSL证书设置
├── generate-ssl.sh            # 生成自签证书
├── check-ssl.sh               # 证书检查
│
├── 🔍 诊断工具
├── diagnose.sh                # 系统诊断
├── verify-deployment.sh       # 部署验证
├── fix-500.sh                 # 修复500错误
│
└── 📊 监控工具
    ├── monitor.sh              # 系统监控
    └── cleanup.sh              # 清理工具
```

## ⚙️ 配置说明

### 环境配置 (.env)

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
nano .env
```

重要配置项：
- `SERVER_PORT`: HTTP服务端口 (默认 8080)
- `TLS_PORT`: HTTPS服务端口 (默认 8443)
- `JWT_SECRET`: JWT密钥 (生产环境必须修改)
- `RUST_LOG`: 日志级别 (info/debug/error)

### 系统服务配置

使用 systemd 管理服务：
```bash
# 安装服务
./install-systemd.sh

# 管理服务
sudo systemctl start elontalk
sudo systemctl stop elontalk
sudo systemctl restart elontalk
sudo systemctl status elontalk

# 设置开机启动
sudo systemctl enable elontalk
```

## 🔧 使用指南

### 启动服务

**智能启动 (推荐):**
```bash
./start.sh
```
自动检测环境、端口冲突、数据库状态等。

**直接启动:**
```bash
./customer-service-backend
```

### 管理服务

```bash
# 查看状态
./status.sh

# 重启服务
./restart.sh

# 停止服务
./stop.sh
```

### 数据库管理

```bash
# 检查数据库状态
./check-database.sh

# 修复数据库问题
./fix-database.sh

# 备份数据库
./backup-database.sh

# 运行数据库迁移
./migrate-database.sh
```

### SSL证书管理

```bash
# 生成自签名证书
./generate-ssl.sh

# 设置Let's Encrypt证书
./setup-ssl.sh your-domain.com

# 检查证书状态
./check-ssl.sh
```

### 故障诊断

```bash
# 运行完整诊断
./diagnose.sh

# 验证部署状态
./verify-deployment.sh

# 修复500错误
./fix-500.sh
```

## 🐛 常见问题解决

### 1. 500 服务器错误

**现象**: API返回500错误，页面无法加载
**原因**: 数据库未正确初始化或为空文件
**解决**: 
```bash
./fix-500.sh
```

### 2. 端口冲突

**现象**: 启动失败，提示端口被占用
**解决**:
```bash
# 查看端口占用
./diagnose.sh

# 或手动检查
sudo netstat -tlnp | grep :8080
```

### 3. 权限问题

**现象**: 可执行文件无法运行
**解决**:
```bash
# 设置权限
chmod +x customer-service-backend
chmod +x *.sh
```

### 4. 数据库问题

**现象**: 数据库连接失败或数据丢失
**解决**:
```bash
./fix-database.sh
```

### 5. SSL证书问题

**现象**: HTTPS无法访问
**解决**:
```bash
./check-ssl.sh
```

## 📊 监控与维护

### 实时监控
```bash
# 查看实时日志
tail -f *.log

# 系统资源监控
./monitor.sh

# 服务状态检查
./status.sh
```

### 定期维护
```bash
# 数据库备份 (建议每日)
./backup-database.sh

# 清理旧日志 (建议每周)
./cleanup.sh

# 系统诊断 (建议每月)
./diagnose.sh
```

## 🔄 更新部署

### 更新后端
```bash
# 1. 停止服务
./stop.sh

# 2. 替换可执行文件
cp /path/to/new/customer-service-backend .

# 3. 运行更新脚本
./update.sh

# 4. 验证更新
./verify-deployment.sh
```

### 更新前端
```bash
# 1. 替换静态文件
rm -rf static/
cp -r /path/to/new/build static/

# 2. 重启服务
./restart.sh
```

## 🚨 紧急恢复

### 数据恢复
```bash
# 从备份恢复
./restore.sh backup_file.sql

# 或手动恢复
cp backup/customer_service.db.backup customer_service.db
```

### 完全重新部署
```bash
# 1. 清理环境
./cleanup.sh

# 2. 重新部署
./deploy.sh

# 3. 验证部署
./verify-deployment.sh
```

## 📋 部署检查清单

在生产环境部署前，请确保：

**基本要求:**
- [ ] 可执行文件存在且有执行权限
- [ ] 前端静态文件完整
- [ ] 环境配置文件已设置
- [ ] 端口未被占用

**安全要求:**
- [ ] JWT_SECRET已修改为复杂密钥
- [ ] 数据库文件权限正确
- [ ] CORS配置符合安全要求
- [ ] SSL证书已配置 (如需要)

**性能要求:**
- [ ] 数据库连接数配置合理
- [ ] 日志级别设置适当
- [ ] 系统资源充足

**监控要求:**
- [ ] 系统服务已安装
- [ ] 监控脚本可用
- [ ] 备份策略已设置

## 🆘 故障联系

如果遇到无法解决的问题：

1. **收集诊断信息:**
   ```bash
   ./diagnose.sh > diagnostic-report.txt
   ```

2. **收集日志信息:**
   ```bash
   tar -czf logs-$(date +%Y%m%d).tar.gz *.log
   ```

3. **提供系统信息:**
   - 操作系统版本
   - 错误信息
   - 部署步骤
   - 诊断报告

## 🔧 AI 代理生成指南

**为确保AI代理能生成完整可用的部署包，请遵循以下要点:**

### 1. 部署包必备组件
- ✅ 编译好的 `customer-service-backend` 可执行文件
- ✅ 构建好的前端静态文件 (`static/` 目录)
- ✅ 完整的脚本工具集 (20+ 个管理脚本)
- ✅ 配置文件模板 (`.env.example`, `elontalk.service`)
- ✅ 详细的使用文档 (`README.md`)

### 2. 脚本功能要求
- **启动管理**: start.sh, stop.sh, restart.sh, status.sh
- **数据库管理**: check/fix/backup/migrate-database.sh
- **SSL管理**: setup/generate/check-ssl.sh
- **诊断工具**: diagnose.sh, verify-deployment.sh, fix-500.sh
- **系统集成**: deploy.sh, install-systemd.sh, monitor.sh

### 3. 问题预防机制
- **数据库初始化**: 确保后端启动时执行数据库迁移
- **前端API配置**: 使用动态API地址，避免硬编码localhost
- **错误处理**: 提供专门的500错误修复工具
- **权限设置**: 自动设置可执行权限

### 4. 验证标准
- 所有脚本必须可执行且功能完整
- 服务能在干净环境中一键启动
- 包含完整的故障诊断和修复能力
- 提供清晰的使用说明和故障排除指南

---

**版本**: v1.0  
**更新时间**: 2024-01-20  
**适用环境**: Ubuntu 20.04/22.04 LTS