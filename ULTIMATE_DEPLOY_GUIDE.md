# 🎯 给任何人/AI的终极部署指南

## ⚡ 最快方法（推荐）

```bash
npm run build:production
```

**完成！** 现在上传 `ubuntu-deploy-ready` 文件夹到服务器。

---

## 📖 详细说明

### 问题：为什么需要特殊处理？

**开发时：**
- 使用 `backend/customer_service.db`（测试数据，可以随意删改）
- 使用 `backend/certs/`（开发证书）

**部署时：**
- 使用 `服务器数据库/customer_service.db`（真实生产数据）
- 使用 `服务器数据库/server.crt` 和 `server.key`（真实证书）

### 解决方案：自动化构建

无论谁编译（人或AI），都使用统一命令：

```bash
npm run build:production
```

这会：
1. ✅ 编译 Rust 后端（Linux HTTPS 版本）
2. ✅ 编译 React 前端
3. ✅ **自动替换**为生产数据库
4. ✅ **自动替换**为生产证书
5. ✅ 验证所有文件正确

---

## 🛡️ 验证是否准备好

```bash
scripts\check-before-deploy.bat
```

**必须看到：**
```
[PASS] Backend binary: 8000000+ bytes
[PASS] Frontend files present
[PASS] Database: 200000+ bytes
[PASS] Certificate: 2000+ bytes
[PASS] Key: 200+ bytes
[SUCCESS] Ready to deploy!
```

---

## 🚀 部署到服务器

```bash
# 1. 上传文件夹
scp -r ubuntu-deploy-ready root@your-server:/root/

# 2. SSH 登录
ssh root@your-server

# 3. 启动服务
cd /root/ubuntu-deploy-ready
chmod +x customer-service-backend *.sh
./start.sh
```

---

## ⛔ 常见错误（请避免）

### ❌ 错误 1: 直接复制开发数据库
```bash
# 不要这样做！
copy backend\customer_service.db ubuntu-deploy-ready\
```

### ❌ 错误 2: 忘记同步生产文件
```bash
# 编译后忘记执行
npm run sync:prod  # 必须执行！
```

### ❌ 错误 3: 不验证就部署
```bash
# 部署前必须检查
scripts\check-before-deploy.bat
```

---

## ✅ 正确流程

### 流程 A: 一键构建（推荐）
```bash
npm run build:production
scripts\check-before-deploy.bat
# 上传到服务器
```

### 流程 B: 分步骤
```bash
# 1. 编译后端
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https

# 2. 复制后端
copy target\x86_64-unknown-linux-musl\release\customer-service-backend ..\ubuntu-deploy-ready\

# 3. 编译前端
cd ..\frontend
npm run build

# 4. 复制前端
xcopy /E /I /Y build\* ..\ubuntu-deploy-ready\static\

# 5. ⚠️ 必须：同步生产文件
cd ..
npm run sync:prod

# 6. ⚠️ 必须：验证
scripts\check-before-deploy.bat

# 7. 上传到服务器
```

---

## 🔐 符号链接方案（最可靠）

**一次性设置（需管理员权限）：**

```batch
# 右键"以管理员身份运行"
scripts\setup-symlinks.bat
```

**设置后：**
- `ubuntu-deploy-ready` 中的生产文件会**物理链接**到 `服务器数据库`
- 任何一方修改，另一方自动同步
- 永久解决文件不一致问题

**注意：** 设置后仍需正常编译代码，但不用担心文件错误

---

## 📋 快速参考卡

| 场景 | 命令 |
|------|------|
| 一键构建部署包 | `npm run build:production` |
| 仅同步生产文件 | `npm run sync:prod` |
| 验证准备状态 | `scripts\check-before-deploy.bat` |
| 符号链接设置 | `scripts\setup-symlinks.bat` (管理员) |
| 完整手动流程 | `scripts\update-deploy-package.bat` |

---

## 💡 给 AI 代理的提示

**复制以下到 AI 对话中：**

```
请使用以下命令构建生产部署包：

npm run build:production

然后验证：

scripts\check-before-deploy.bat

看到 [SUCCESS] 后，上传 ubuntu-deploy-ready 文件夹到服务器 /root/
```

---

## 🆘 故障排除

### 问题：验证失败
**解决：**
```bash
npm run sync:prod
scripts\verify-production-files.bat
```

### 问题：文件大小不对
**解决：**
```bash
# 重新编译
npm run build:production
```

### 问题：不确定用的是哪个数据库
**解决：**
```bash
# 查看部署包中的数据库大小
dir ubuntu-deploy-ready\customer_service.db

# 生产数据库应该是 ~212 KB
# 如果是几十 KB，说明用错了
```

---

**记住：只有 `服务器数据库/` 中的文件才是真实的生产文件！**
