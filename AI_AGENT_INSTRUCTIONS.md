# 🤖 AI 代理强制执行指令

## ⚠️ 最重要的事：部署 = 开发 + 生产文件同步

**开发数据库** ≠ **生产数据库**  
**开发证书** ≠ **生产证书**

编译时使用开发文件是正常的，但**部署前必须替换为生产文件**！

## 🚀 推荐方法（最简单）

### 一键构建生产包

```bash
npm run build:production
```

**这会自动：**
1. ✅ 编译后端（Linux HTTPS）
2. ✅ 编译前端
3. ✅ 同步生产数据库
4. ✅ 同步生产证书和密钥
5. ✅ 验证完整性

**执行后直接上传 `ubuntu-deploy-ready` 文件夹到服务器！**

## 📋 其他方法

### 方法 1: 使用批处理脚本

```powershell
$Prod="E:\duihua\customer-service-system\服务器数据库";$Deploy="E:\duihua\customer-service-system\ubuntu-deploy-ready";Copy-Item "$Prod\customer_service.db" "$Deploy\customer_service.db" -Force;Copy-Item "$Prod\server.crt" "$Deploy\certs\server.crt" -Force;Copy-Item "$Prod\server.key" "$Deploy\certs\server.key" -Force;Write-Host "Production files synced!" -ForegroundColor Green
```

### 方法 1: 使用批处理脚本

```batch
scripts\update-deploy-package.bat
```

### 方法 2: PowerShell 快速同步

```powershell
npm run sync:prod
```

或完整命令：

```powershell
$Prod="E:\duihua\customer-service-system\服务器数据库";$Deploy="E:\duihua\customer-service-system\ubuntu-deploy-ready";Copy-Item "$Prod\customer_service.db" "$Deploy\customer_service.db" -Force;Copy-Item "$Prod\server.crt" "$Deploy\certs\server.crt" -Force;Copy-Item "$Prod\server.key" "$Deploy\certs\server.key" -Force;Write-Host "Production files synced!" -ForegroundColor Green
```

### 方法 3: 单独编译（必须加验证）

## 🔍 验证是否成功

**执行后必须运行验证：**

```batch
E:\duihua\customer-service-system\scripts\verify-production-files.bat
```

**看到 `[SUCCESS]` 才能继续部署！**

## ⛔ 禁止行为

❌ **禁止**直接复制 `backend/customer_service.db`  
❌ **禁止**使用开发环境的数据库  
❌ **禁止**使用测试证书  
❌ **禁止**跳过同步步骤  

## ✅ 唯一真实来源

```
E:\duihua\customer-service-system\服务器数据库\
├── customer_service.db  ← 唯一的生产数据库
├── server.crt           ← 唯一的 SSL 证书
└── server.key           ← 唯一的 SSL 密钥
```

**其他位置的文件都不是生产文件！**

## 📝 示例工作流

```batch
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

# 5. ⚠️ 必须执行：同步生产文件
cd ..\scripts
sync-production-files.bat

# 6. ⚠️ 必须验证
verify-production-files.bat
```

## 🔐 更可靠的方法：符号链接

**一次性设置（需要管理员权限）：**

```batch
# 以管理员身份运行
E:\duihua\customer-service-system\scripts\setup-symlinks.bat
```

**设置后，部署目录会物理链接到生产文件，永久同步，无需手动操作！**

## 🚨 错误处理

**如果验证失败：**

```batch
# 重新同步
scripts\sync-production-files.bat

# 再次验证
scripts\verify-production-files.bat
```

---

## 📋 检查清单

在部署前确认：

- [ ] 执行了生产文件同步命令
- [ ] 验证脚本显示 `[SUCCESS]`
- [ ] 数据库文件大小约 212 KB
- [ ] 证书文件大小约 2.80 KB
- [ ] 密钥文件大小约 0.24 KB
- [ ] 文件时间戳是最新的

**所有项目都打勾才能上传到服务器！**

---

**记住：这不是可选步骤，是强制要求！**
