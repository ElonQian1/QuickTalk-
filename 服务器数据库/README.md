# 生产环境文件管理说明

## 📁 目录结构

```
E:\duihua\customer-service-system\
├── 服务器数据库/              ⭐ 生产环境文件（真实数据）
│   ├── customer_service.db    # 生产环境数据库
│   ├── server.crt             # 生产环境 SSL 证书
│   └── server.key             # 生产环境 SSL 密钥
│
├── ubuntu-deploy-ready/       ⭐ 部署包（同步到 Ubuntu）
│   ├── customer-service-backend
│   ├── customer_service.db    # 从生产环境同步
│   ├── certs/
│   │   ├── server.crt         # 从生产环境同步
│   │   └── server.key         # 从生产环境同步
│   └── static/
│
└── scripts/
    ├── update-deploy-package.ps1      # 完整部署包更新
    └── sync-production-files.ps1      # 仅同步生产文件
```

## 🚀 使用方法

### 方法 1: 完整更新部署包（推荐）

**用途**: 编译新代码 + 同步生产环境文件

```powershell
npm run deploy:update
```

**这个命令会自动：**
1. ✅ 编译 Rust 后端（Linux HTTPS 版本）
2. ✅ 编译 React 前端
3. ✅ 复制所有静态文件和 SDK
4. ✅ **自动同步生产环境数据库**
5. ✅ **自动同步生产环境证书和密钥**

### 方法 2: 仅同步生产环境文件

**用途**: 不重新编译，只更新数据库和证书

```powershell
npm run deploy:sync-production
```

**这个命令会：**
1. ✅ 复制生产环境数据库到部署包
2. ✅ 复制生产环境证书到部署包
3. ✅ 复制生产环境密钥到部署包

## ⚠️ 重要说明

### 为什么需要这个？

**问题**: 编译时总是使用错误的数据库或证书
**原因**: 
- 项目中有多个数据库文件（开发用、测试用）
- 项目中有多个证书文件（开发证书、测试证书）
- 编译脚本不知道哪个才是生产环境的

**解决方案**:
- 所有生产环境的真实文件统一存放在 `服务器数据库/` 目录
- 使用自动化脚本确保部署包始终使用正确的文件

### 生产环境文件的真实来源

```
服务器数据库/customer_service.db  ← 这是真实的生产数据库
服务器数据库/server.crt           ← 这是真实的 SSL 证书
服务器数据库/server.key           ← 这是真实的 SSL 密钥
```

**部署包会自动从这里复制！**

## 📝 工作流程

### 日常开发流程

1. **修改代码**（前端或后端）

2. **更新部署包**
   ```powershell
   npm run deploy:update
   ```

3. **上传到 Ubuntu 服务器**
   - 上传整个 `ubuntu-deploy-ready` 文件夹到 `/root/`

4. **在服务器上启动**
   ```bash
   cd /root/ubuntu-deploy-ready
   chmod +x customer-service-backend *.sh
   ./start.sh
   ```

### 仅更新数据库/证书

如果你只是想更新生产环境的数据库或证书：

1. **更新 `服务器数据库/` 目录中的文件**
   - 替换 `customer_service.db`（新的生产数据库）
   - 替换 `server.crt` 和 `server.key`（新的证书）

2. **同步到部署包**
   ```powershell
   npm run deploy:sync-production
   ```

3. **上传到服务器**

## 🔍 验证

每次运行脚本后，会自动显示验证信息：

```
✅ 数据库: customer_service.db - XXX KB - 2025/10/17 1:41:36
✅ 证书: server.crt - XXX KB - 2025/10/17 1:41:36  
✅ 密钥: server.key - XXX KB - 2025/10/17 1:41:27
```

确保时间戳是最新的，证明文件已正确更新。

## 🎯 最佳实践

1. **永远不要手动复制文件** - 使用脚本自动化
2. **修改代码后总是运行** `npm run deploy:update`
3. **生产文件只放在** `服务器数据库/` 目录
4. **部署前验证** 时间戳和文件大小
5. **备份重要数据** 在更新前备份生产数据库

## 🛠️ 故障排除

### 问题：部署后使用的是旧数据库

**解决**:
```powershell
npm run deploy:sync-production
```

### 问题：HTTPS 证书错误

**解决**:
1. 检查 `服务器数据库/server.crt` 和 `server.key` 是否是正确的
2. 运行 `npm run deploy:sync-production`
3. 重新上传到服务器

### 问题：不确定哪个是生产文件

**答案**: 只有这三个文件是真实的生产环境文件：
- `E:\duihua\customer-service-system\服务器数据库\customer_service.db`
- `E:\duihua\customer-service-system\服务器数据库\server.crt`
- `E:\duihua\customer-service-system\服务器数据库\server.key`

其他位置的文件都是开发/测试用的。

---

**最后更新**: 2025年10月17日  
**维护者**: 项目团队
