# 🔧 开发者工具指南

本目录包含项目开发和部署的实用脚本工具。

## 📁 目录结构

```
scripts/
├── sync-schema.sh              - 数据库Schema同步脚本 (Linux/Mac)
├── sync-schema.bat             - 数据库Schema同步脚本 (Windows)
├── pre-commit-schema-check.sh  - Git pre-commit hook (Schema检查)
├── generate-cert.sh            - SSL证书生成脚本 (Linux/Mac)
└── generate-cert.bat           - SSL证书生成脚本 (Windows)
```

## 🎯 核心工具

### 1. Schema同步工具 ⭐ 重要

**问题背景**: 项目中存在两个数据库架构文件：
- `backend/src/schema.sql` - Rust编译时使用
- `ubuntu-deploy-complete/database_schema.sql` - 部署时使用

这两个文件必须保持同步，否则会导致生产环境数据库错误。

**使用方法**:

```bash
# Linux/Mac
./scripts/sync-schema.sh

# Windows
.\scripts\sync-schema.bat
```

**何时使用**:
- ✅ 修改 `backend/src/schema.sql` 后
- ✅ 添加新表或修改表结构后
- ✅ 提交代码前验证同步

**自动检查**:

安装Git hook以自动检查：

```bash
# 复制pre-commit hook
cp scripts/pre-commit-schema-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# 测试
git add backend/src/schema.sql
git commit -m "test"  # 如果schema未同步，会阻止提交
```

### 2. SSL证书生成工具

用于开发环境生成自签名SSL证书。

```bash
# Linux/Mac
./scripts/generate-cert.sh

# Windows  
.\scripts\generate-cert.bat
```

生成的证书位于 `certs/` 目录。

## 🚀 常见工作流程

### 修改数据库结构

```bash
# 1. 修改schema
vim backend/src/schema.sql

# 2. 同步到部署包
./scripts/sync-schema.sh

# 3. 测试
cargo run

# 4. 提交（自动检查会验证同步）
git add backend/src/schema.sql ubuntu-deploy-complete/database_schema.sql
git commit -m "feat: 添加新表 xxx"
```

### 部署到生产

```bash
# 1. 确保schema已同步
./scripts/sync-schema.sh

# 2. 提交并推送
git push origin main

# 3. 服务器上更新
ssh user@server "cd /opt/elontalk && git pull && ./ubuntu-deploy-complete/rebuild-database.sh"
```

## ⚠️ 重要提醒

### Schema同步是强制性的！

❌ **错误示例** - 不要这样做：

```bash
# 只修改 backend/src/schema.sql
vim backend/src/schema.sql
git add backend/src/schema.sql
git commit -m "add new table"
# ⚠️ 部署包的schema没有更新！生产环境会出错！
```

✅ **正确示例**:

```bash
# 修改schema
vim backend/src/schema.sql

# 同步到部署包
./scripts/sync-schema.sh

# 一起提交
git add backend/src/schema.sql ubuntu-deploy-complete/database_schema.sql
git commit -m "feat: add new table"
```

## 📚 相关文档

- [数据库管理指南](../ubuntu-deploy-complete/DATABASE-README.md)
- [数据库问题分析](../ubuntu-deploy-complete/DATABASE-ANALYSIS.md)
- [部署指南](../DEPLOYMENT.md)

## 🔍 故障排除

### Schema文件不同步

**症状**: 生产环境API返回500错误，本地测试正常

**诊断**:
```bash
# 检查两个文件是否一致
diff backend/src/schema.sql ubuntu-deploy-complete/database_schema.sql
```

**修复**:
```bash
./scripts/sync-schema.sh
```

### Git hook不工作

**症状**: 提交时没有schema检查

**修复**:
```bash
# 重新安装hook
cp scripts/pre-commit-schema-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 🤝 贡献指南

添加新工具脚本时：

1. 同时提供 `.sh` (Linux/Mac) 和 `.bat` (Windows) 版本
2. 在脚本中添加详细的注释说明用途
3. 更新本README文档
4. 提供使用示例

---

**维护者**: 项目团队  
**最后更新**: 2025-10-14
