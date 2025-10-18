# 🔧 SQL歧义错误修复报告

## 📋 问题概述

**日期**: 2025-10-18  
**影响**: 生产环境 overview 接口返回 500 错误，导致消息未读统计和通知功能异常

## 🔍 错误详情

### 后端错误
```
ERROR: ambiguous column name: last_msg_created_at
```

### 具体位置
- `/api/shops/overview` - 店主店铺概览
- `/api/staff/shops/overview` - 员工店铺概览

## 🎯 根本原因

在 SQL 查询的 ORDER BY 子句中使用了裸列名 `last_msg_created_at`，但该列名同时存在于两个 CTE 中:
1. `per_shop_last` - 计算最后活动时间
2. `per_shop_last_msg` - 获取最后一条消息详情

SQLite 无法判断应该使用哪个表的列，导致歧义错误。

## ✅ 修复方案

### 代码修改
**文件**: `backend/src/services/metrics.rs`

**修改内容**:
```rust
// 修复前 (有歧义)
"ORDER BY unread_total DESC, COALESCE(last_msg_created_at, s.created_at) DESC"

// 修复后 (明确指定表别名)
"ORDER BY unread_total DESC, COALESCE(l.last_msg_created_at, s.created_at) DESC"
```

**影响函数**:
1. `fetch_shops_overview_by_owner_paged` (行 355)
2. `fetch_shops_overview_by_staff_paged` (行 460)

### 修复逻辑
- 使用表别名 `l.` (即 `per_shop_last` 的别名) 来明确引用
- 这样 SQL 引擎可以明确知道使用哪个 CTE 的 `last_msg_created_at`

## 🧪 验证步骤

### 1. 编译验证
```bash
cd backend
cargo build --release
```
✅ 预期结果: 编译成功，无警告

### 2. 本地测试
```bash
# 启动后端
./customer-service-backend

# 测试 API
curl -H "Authorization: Bearer <token>" https://localhost:8443/api/shops/overview
```
✅ 预期结果: HTTP 200，返回店铺列表

### 3. 生产部署
```bash
# 复制二进制到部署包
Copy-Item backend\target\release\customer-service-backend.exe ubuntu-deploy-ready\customer-service-backend -Force

# 上传到服务器
# ... (使用你的上传脚本)

# 重启服务
sudo systemctl restart customer-service

# 查看日志
sudo journalctl -u customer-service -f
```

## 📊 预期效果

修复后，以下功能将恢复正常:

### 前端
- ✅ 底部导航"消息" Tab 显示未读红点
- ✅ 新消息到来时播放提示音
- ✅ 店铺列表按活跃度正确排序
- ✅ 显示最后一条消息预览

### 后端
- ✅ `/api/shops/overview` 返回 200
- ✅ `/api/staff/shops/overview` 返回 200
- ✅ 正确聚合 unread_count、last_activity、last_message

## 🔄 相关系统行为

### 前端回退机制 (已存在)
如果 overview 接口失败，前端会自动回退到传统接口:
```typescript
// MessagesPage.tsx
try {
  const [ownerResp, staffResp] = await Promise.allSettled([
    fetchShopsOverview(),
    fetchStaffShopsOverview(),
  ]);
  // ...
} catch {
  // 回退到传统接口
  const shops = await fetchShops();
}
```

这就是为什么在 500 错误期间应用仍能部分工作的原因。

### 数据初始化流程
1. `GlobalWSBootstrap` 组件在登录后执行
2. 调用 overview 接口获取店铺+未读统计
3. 存入 `notificationsStore.setManyShopUnreads()`
4. `BottomTabBar` 从 store 读取并显示

**修复后**: 步骤2不再失败 → 步骤3正确初始化 → 步骤4显示红点

## 🎯 部署清单

- [ ] 后端编译成功
- [ ] 本地测试 overview 接口返回 200
- [ ] 复制二进制到 ubuntu-deploy-ready
- [ ] 上传到生产服务器
- [ ] 重启服务
- [ ] 验证 overview 接口无 500 错误
- [ ] 前端红点恢复显示
- [ ] 新消息提示音正常播放

## 📝 附加说明

### 为什么会有这个 bug?
- 最初实现时使用了简化的列名
- SQLite 对歧义列名的容忍度较低
- 开发环境可能没有足够的测试数据覆盖所有排序场景

### 如何避免类似问题?
1. 在 CTE 中始终使用表别名
2. 添加集成测试覆盖 overview 端点
3. 在 SQL 审查中检查所有 JOIN/CTE 的列引用

## 🔗 相关文件

- `backend/src/services/metrics.rs` - 主修复文件
- `backend/src/handlers/shop.rs` - API 路由定义
- `frontend/src/services/overview.ts` - 前端调用层
- `frontend/src/stores/notificationsStore.ts` - 未读状态管理

## 📞 联系

如有问题，请检查:
1. 后端日志: `sudo journalctl -u customer-service -n 50`
2. 前端控制台: 浏览器开发者工具
3. 网络请求: 检查 overview 接口响应状态码

---
**修复人**: GitHub Copilot  
**审核人**: (待填写)  
**部署时间**: (待填写)
