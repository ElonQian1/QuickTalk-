# 🌳 Git 分支管理指南

## 📋 当前分支结构

```
master (主分支)      ←── 生产环境代码，稳定版本
│
├── develop (开发分支) ←── 开发环境代码，功能集成
│
└── elon (个人分支)   ←── Elon 的个人开发分支
```

## 🔄 多人开发工作流

### 1. **分支职责**

- **`master`** - 生产环境分支
  - 只包含经过测试的稳定代码
  - 只接受来自 `develop` 的合并请求
  - 每次合并都应该打 tag 标记版本

- **`develop`** - 开发集成分支
  - 所有功能开发完成后合并到这里
  - 用于集成测试和预发布
  - 定期合并到 `master`

- **`elon`** - 个人开发分支
  - Elon 的所有功能开发都在这个分支
  - 可以随时提交和推送
  - 功能完成后合并到 `develop`

### 2. **日常开发流程**

#### 开始新功能开发
```bash
# 1. 切换到 elon 分支
git checkout elon

# 2. 从 develop 获取最新代码
git pull origin develop

# 3. 开始开发...
# 编写代码、测试功能

# 4. 提交更改
git add .
git commit -m "✨ 新增功能: 描述你的功能"

# 5. 推送到远程 elon 分支
git push origin elon
```

#### 功能完成后合并
```bash
# 1. 确保代码已提交并推送
git push origin elon

# 2. 切换到 develop 分支
git checkout develop

# 3. 拉取最新的 develop 代码
git pull origin develop

# 4. 合并 elon 分支的更改
git merge elon

# 5. 推送合并后的 develop
git push origin develop
```

#### 发布到生产环境
```bash
# 1. 切换到 master 分支
git checkout master

# 2. 合并 develop 分支
git merge develop

# 3. 打标签版本
git tag -a v1.x.x -m "发布版本 v1.x.x"

# 4. 推送到远程
git push origin master --tags
```

### 3. **最佳实践**

#### ✅ **推荐做法**
- 在 `elon` 分支上进行所有开发工作
- 经常提交，保持提交历史清晰
- 使用有意义的提交信息
- 功能完成后再合并到 `develop`
- 定期从 `develop` 同步最新代码

#### ❌ **避免做法**
- 直接在 `master` 分支上开发
- 长期不合并导致分支差异过大
- 提交信息不清晰
- 不测试就合并到 `develop`

### 4. **提交信息规范**

```
类型: 简短描述

✨ feat: 新功能
🐛 fix: 修复bug
📝 docs: 更新文档
🎨 style: 代码格式化
♻️ refactor: 重构代码
🧹 chore: 清理代码/文件
```

#### 示例：
```
✨ feat: 添加店铺审核功能
🐛 fix: 修复登录验证问题
📝 docs: 更新API文档
🧹 chore: 删除旧的Rust代码
```

### 5. **冲突解决**

当出现合并冲突时：
```bash
# 1. 拉取最新的目标分支
git pull origin develop

# 2. 如果有冲突，手动解决
# 编辑冲突文件，删除冲突标记

# 3. 标记冲突已解决
git add .

# 4. 完成合并
git commit -m "🔧 解决合并冲突"
```

### 6. **团队协作建议**

#### 对于团队成员
- 每个人都有自己的个人分支（如 `elon`, `alice`, `bob`）
- 在个人分支上自由开发，不影响他人
- 功能完成后通过 Pull Request 合并到 `develop`

#### 对于项目管理者
- 定期检查 `develop` 分支的代码质量
- 安排集成测试和发布节奏
- 管理 `master` 分支的发布流程

## 🎯 当前状态

- ✅ **当前分支**: `elon`
- ✅ **可以开始开发**: 在 elon 分支上进行所有功能开发
- ✅ **安全**: 不会影响 master 分支的稳定性

## 🚀 下一步

1. 在 `elon` 分支上继续开发新功能
2. 定期提交和推送代码
3. 功能完成后合并到 `develop`
4. 经过测试后发布到 `master`

这样的分支管理策略可以确保：
- 代码质量和稳定性
- 团队成员独立开发不冲突
- 清晰的版本控制和发布流程
- 出问题时可以快速回滚
