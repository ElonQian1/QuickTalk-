# 开发环境 vs 生产环境文件管理策略

## 🎯 核心原则

**开发环境** - 使用本地测试数据，随意测试  
**生产环境** - 使用真实数据，仅部署时使用

## 📁 文件结构规范

```
E:\duihua\customer-service-system\
│
├── backend/
│   └── customer_service.db          ← 开发数据库（本地测试用）
│
├── 服务器数据库/                     ← 生产环境文件（唯一真实来源）
│   ├── customer_service.db          ← 生产数据库（真实数据）
│   ├── server.crt                   ← 生产证书
│   └── server.key                   ← 生产密钥
│
└── ubuntu-deploy-ready/              ← 部署包（自动同步生产文件）
    ├── customer_service.db          ← 从生产环境自动复制
    └── certs/
        ├── server.crt               ← 从生产环境自动复制
        └── server.key               ← 从生产环境自动复制
```

## 🔄 工作流程

### 开发阶段（本地）
```powershell
# 使用本地开发数据库
cd backend
cargo run --features https

# 数据库位置：backend/customer_service.db
# 可以随意测试，不影响生产环境
```

### 编译部署（生产）
```batch
# 方式 1: 使用自动化脚本（推荐）
scripts\update-deploy-package.bat

# 方式 2: 手动编译 + 自动同步
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
cd ..\scripts
sync-production-files.bat
verify-production-files.bat
```

## 🛡️ 强制约束机制

### 1. 构建钩子（自动执行）

创建 `package.json` 的 postbuild 钩子：

```json
{
  "scripts": {
    "build:production": "npm run compile && npm run sync-prod",
    "compile": "cd backend && cargo zigbuild --release --target x86_64-unknown-linux-musl --features https",
    "sync-prod": "scripts\\sync-production-files.bat && scripts\\verify-production-files.bat"
  }
}
```

### 2. Git Hooks（部署前检查）

创建 `.git/hooks/pre-push`：
- 检查部署包是否使用了生产文件
- 验证文件完整性
- 不通过则阻止提交

### 3. 符号链接（最可靠）

**一次性设置后，物理上保证一致性**

## 🚀 给其他 AI 代理的统一指令

### 强制构建流程

**任何 AI 代理编译项目时，必须使用以下命令之一：**

#### 选项 1: 使用统一脚本（推荐）
```batch
scripts\update-deploy-package.bat
```
这会自动：
1. 编译后端
2. 编译前端
3. 同步生产文件
4. 验证完整性

#### 选项 2: 使用 npm 命令
```bash
npm run build:production
```

#### 选项 3: 手动编译（必须加验证）
```batch
# 编译
cd backend
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https

# ⚠️ 强制步骤：同步生产文件
cd ..\scripts
sync-production-files.bat

# ⚠️ 强制步骤：验证
verify-production-files.bat
```

## 📋 检查清单（部署前必须确认）

```batch
# 运行验证
scripts\verify-production-files.bat
```

**必须看到：**
```
[OK] Database: 217088 bytes
[OK] Certificate: 2867 bytes
[OK] Key: 246 bytes
[SUCCESS] All production files verified!
```

## 🔐 最可靠方案：符号链接

### 一次性设置（需管理员权限）

```batch
# 以管理员身份运行
scripts\setup-symlinks.bat
```

**设置后效果：**
- `ubuntu-deploy-ready\customer_service.db` → 指向 `服务器数据库\customer_service.db`
- `ubuntu-deploy-ready\certs\server.crt` → 指向 `服务器数据库\server.crt`
- `ubuntu-deploy-ready\certs\server.key` → 指向 `服务器数据库\server.key`

**优势：**
- ✅ 物理链接，永久同步
- ✅ 无需手动复制
- ✅ 无法使用错误文件
- ✅ 任何修改自动反映

## ⚠️ 常见错误

### ❌ 错误做法
```batch
# 直接复制开发数据库
copy backend\customer_service.db ubuntu-deploy-ready\

# 使用错误的证书
copy backend\certs\*.* ubuntu-deploy-ready\certs\
```

### ✅ 正确做法
```batch
# 始终从生产环境文件夹复制
scripts\sync-production-files.bat
```

## 🤖 AI 代理检查脚本

创建一个 AI 可以运行的检查命令：

```batch
scripts\check-before-deploy.bat
```

这会检查：
1. 后端是否编译
2. 前端是否编译
3. 生产文件是否同步
4. 文件完整性是否正确

**只有全部通过才能部署！**

---

## 总结

✅ **开发** - 用本地数据库，随意测试  
✅ **部署** - 自动同步生产文件，强制验证  
✅ **约束** - 符号链接 + 验证脚本，物理保证  

**这样既保护了生产环境，又确保部署正确！**
