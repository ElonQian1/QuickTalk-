# ⚠️ 生产环境文件 - 请勿手动修改

## 📁 这个文件夹包含什么？

```
服务器数据库/
├── customer_service.db  ← 生产环境数据库（真实用户数据）
├── server.crt           ← SSL 证书（HTTPS 必需）
└── server.key           ← SSL 私钥（HTTPS 必需）
```

## 🔒 重要性

**这是唯一的生产环境文件来源！**

- ✅ 部署时自动使用这些文件
- ✅ Git 跟踪这些文件（保证团队一致性）
- ✅ 其他位置的数据库都是开发测试用

## 🚫 请勿直接编辑

**不要手动修改这些文件！** 除非：
- 更新生产数据库备份
- 续期/更换 SSL 证书
- 明确知道自己在做什么

## 🤖 自动化使用

这些文件会被自动脚本使用：

```bash
# 一键构建（自动使用这些文件）
npm run build:production

# 仅同步这些文件到部署包
npm run sync:prod

# 验证这些文件是否正确同步
scripts\verify-production-files.bat
```

## 📝 文件说明

### customer_service.db
- **类型**: SQLite 数据库
- **内容**: 用户、店铺、会话、消息等真实数据
- **大小**: 约 212 KB（会增长）
- **用途**: 生产环境唯一数据源

### server.crt
- **类型**: SSL/TLS 证书
- **内容**: 公钥证书
- **大小**: 约 2.80 KB
- **用途**: HTTPS 加密通信

### server.key
- **类型**: SSL/TLS 私钥
- **内容**: 私钥（敏感！）
- **大小**: 约 0.24 KB
- **安全**: 不要泄露此文件

## � 更新流程

### 更新数据库
```bash
# 1. 从服务器下载最新数据库
scp root@server:/root/ubuntu-deploy-ready/customer_service.db ./服务器数据库/

# 2. 提交到 Git
git add 服务器数据库/customer_service.db
git commit -m "Update production database"
```

### 更新证书
```bash
# 1. 将新证书放到这个文件夹
copy new-server.crt 服务器数据库\server.crt
copy new-server.key 服务器数据库\server.key

# 2. 重新构建部署包
npm run build:production

# 3. 部署到服务器
```

## ✅ 验证文件完整性

```bash
# 检查文件是否存在且大小正常
dir 服务器数据库\*.*

# 验证是否正确同步到部署包
scripts\verify-production-files.bat
```

---

**最后更新**: 2025年10月17日  
**维护者**: 项目团队
