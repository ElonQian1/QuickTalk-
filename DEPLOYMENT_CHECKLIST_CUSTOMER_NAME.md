# 🚀 客户名称统一化功能 - 部署检查清单

## ✅ 编译检查

- [x] 前端类型检查通过 (`npm run -w frontend typecheck`)
- [x] 后端编译成功 (`cargo build`)
- [x] 可执行文件已生成 (`backend/target/x86_64-pc-windows-gnu/debug/customer-service-backend.exe`)
- [x] 文件已复制到部署目录 (`ubuntu-deploy-ready/customer-service-backend`)

## 📦 部署准备

- [ ] 备份当前生产环境二进制文件
- [ ] 上传新版本到服务器
- [ ] 重启后端服务
- [ ] 验证服务启动成功

## 🧪 功能测试

### 测试用例 1: 客户列表显示
- [ ] 打开客户列表页面
- [ ] 记录某个客户的显示名称（例如：`用户tyvk`）
- [ ] 确认显示逻辑符合优先级：姓名 > 邮箱 > ID后4位

### 测试用例 2: 聊天页面显示
- [ ] 从客户列表进入聊天页面
- [ ] 确认聊天页面头部显示**相同的客户名称**
- [ ] 确认不再显示 `客户（数字ID）` 格式

### 测试用例 3: API 响应检查
```bash
# 检查 Session 接口返回完整客户对象
curl -X GET "https://elontalk.duckdns.org:8443/api/sessions/{session_id}" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.customer'
```
预期返回：
```json
{
  "id": 185,
  "customer_id": "tyvk",
  "customer_name": null,
  "customer_email": null,
  // ...其他字段
}
```

### 测试用例 4: 降级处理
- [ ] 模拟后端返回不完整数据
- [ ] 确认前端显示降级为 `客户（数字ID）`
- [ ] 不出现应用崩溃或白屏

## 🔄 回滚方案

如果出现问题，执行以下步骤回滚：

```bash
# 1. 停止服务
sudo systemctl stop customer-service

# 2. 恢复备份的二进制文件
mv customer-service-backend.backup customer-service-backend

# 3. 重启服务
sudo systemctl start customer-service

# 4. 验证服务状态
sudo systemctl status customer-service
```

## 📊 监控指标

部署后监控以下指标（24小时内）：

- [ ] API 响应时间无明显增加（< 10ms 差异）
- [ ] 错误率保持稳定（< 0.1%）
- [ ] 客户列表加载时间正常
- [ ] 聊天页面加载时间正常
- [ ] 无前端控制台错误

## 🐛 已知问题

无已知问题。

## 📝 备注

- 此功能无数据库迁移，可安全部署
- 前端已通过 TypeScript 严格类型检查
- 后端仅有警告，无编译错误
- API 响应向后兼容，不影响现有客户端

---

**准备时间**: 2025年10月18日  
**部署窗口**: 建议非高峰时段  
**预计停机时间**: < 1分钟  
**影响范围**: 客户名称显示逻辑
