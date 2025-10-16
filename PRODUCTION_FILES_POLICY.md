# ⚠️ 生产环境文件管理规范 - 强制执行

## 🔒 核心原则：单一数据源（Single Source of Truth）

**唯一的生产环境文件存放位置：**
```
E:\duihua\customer-service-system\服务器数据库\
├── customer_service.db  ← 生产数据库
├── server.crt           ← SSL 证书
└── server.key           ← SSL 密钥
```

## ⛔ 强制约束机制

### 1. Git 忽略规则（防止错误提交）

**已配置 `.gitignore`**，确保只跟踪生产文件，忽略其他位置的数据库：

```gitignore
# 忽略所有数据库文件
*.db
*.db-shm
*.db-wal

# 但保留生产环境文件夹中的数据库
!服务器数据库/*.db
!服务器数据库/*.crt
!服务器数据库/*.key
```

### 2. 构建后钩子（Post-Build Hook）

**自动执行**：编译完成后自动同步生产文件，无需手动操作。

### 3. 符号链接（Symbolic Link）

**最可靠的方法**：让部署目录直接链接到生产文件，物理上保证一致性。

### 4. 只读保护

**防止误修改**：将生产环境文件夹设为只读，只能通过特定脚本更新。

## 📋 强制执行清单

### ✅ 方案 1: 符号链接（推荐 - 物理约束）

让部署包直接使用生产文件，任何修改都会反映到生产环境。

### ✅ 方案 2: 构建验证脚本

每次编译后自动检查并同步，失败则中断部署。

### ✅ 方案 3: 文件完整性校验

使用哈希值验证，确保使用的是正确的生产文件。

## 🤖 给 AI 代理的明确指令

**复制以下内容给任何 AI 代理：**

```markdown
⚠️ 重要：部署前必须执行的步骤

无论你使用什么方式编译项目，在编译完成后必须执行：

PowerShell 命令：
$Prod="E:\duihua\customer-service-system\服务器数据库";$Deploy="E:\duihua\customer-service-system\ubuntu-deploy-ready";Copy-Item "$Prod\customer_service.db" "$Deploy\customer_service.db" -Force;Copy-Item "$Prod\server.crt" "$Deploy\certs\server.crt" -Force;Copy-Item "$Prod\server.key" "$Deploy\certs\server.key" -Force

或批处理命令：
E:\duihua\customer-service-system\scripts\sync-production-files.bat

这是强制性步骤，不可跳过！
```

## 🔐 实施建议

1. **使用符号链接** - 最可靠
2. **添加构建验证** - 自动检查
3. **文件完整性校验** - 双重保险
4. **文档化约束** - 明确规范

---

**警告**：任何绕过此流程的部署都可能导致使用错误的数据库或证书！
