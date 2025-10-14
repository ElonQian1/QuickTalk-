# 数据库与代码结构最终审计报告
日期：2025-10-15
审计范围：SQLite 物理库 (customer_service.db) / Sea-ORM 迁移 / entities / repositories / services / stats 相关聚合

## 1. 已完成修复概览
| 编号 | 问题 | 原始症状 | 修复措施 | 状态 |
|------|------|----------|----------|------|
| 1 | /api/dashboard/stats 500 | unread_counts 结构假设错误 | 统一 unread_counts 为 (shop_id, customer_id) 模型 | ✅ |
| 2 | 迁移与真实表结构严重漂移 | 运行时列缺失/查询失败 | 重写 20241014_* 迁移文件与物理表对齐 | ✅ |
| 3 | 同时存在手写建表逻辑与 Sea-ORM 迁移 | 双源导致未来再次漂移 | 移除手动 create_tables_manually，保留 Migrator | ✅ |
| 4 | sessions 代码访问不存在列 (priority / ended_at / updated_at / session_id) | 编译失败 | 精简 repository & model mapping | ✅ |
| 5 | customers 映射使用 is_blocked / created_at / updated_at | 字段不存在 | 使用 first_visit_at / last_active_at / status | ✅ |
| 6 | unread_counts entity 旧设计 (session/staff) | 统计逻辑错误 | 重写 entity + repository | ✅ |
| 7 | shop_staffs 代码引用 permissions / is_active / joined_at / updated_at | 物理表无列 | 移除写入引用，保留最小 role + created_at | ✅ |
| 8 | 健康检查缺失 | 无法早发现漂移 | 新增启动 schema health 检测 | ✅ |
| 9 | 迁移回滚策略缺失说明 | 运维风险 | 文档阐述只增不改策略 | ✅ |

## 2. 当前结构一致性状态
- 物理表 与 Sea-ORM 迁移：一致。
- 物理表 与 entities：
  - 完全对齐：users / shops / customers / sessions / unread_counts / shop_staffs / online_status
  - 存在超集字段：messages (实体多出 rich_content/metadata/is_deleted/updated_at 等) → 不影响当前插入查询（多余字段不会写入 DB），但使用时需迁移补齐。
- repositories 与实体：已剔除不存在字段引用；messages repository 仍使用 is_deleted / updated_at 字段（实体存在，物理表缺失）→ 当前 insert 时未引用这些字段会触发潜在编译通过但逻辑语义“伪软删”。需迁移引入列或移除该逻辑。

## 3. 剩余风险与差异清单
| 模块 | 差异类型 | 详情 | 风险等级 | 建议 |
|------|----------|------|----------|------|
| messages 实体 | 逻辑>物理 | is_deleted / updated_at / metadata / rich_content 等未落库 | 中 | 视功能需求新增迁移添加列；或裁剪实体字段 |
| MessageRepository.soft_delete / mark_as_read | 写入语义与物理结构不一致 | 依赖 is_deleted / updated_at / read_at 列（物理不存在 read_at / is_deleted / updated_at） | 高 | 第一优先：添加补齐迁移（推荐） |
| shop_staffs 扩展权限 | 缺少权限体系 | 业务未来可能需要 | 低 | 采用新表 staff_permissions 而不是 JSON 列 |
| unread_counts 粒度 | 仅按客户总计 | 无法区分不同客服的已读/未读 | 中 | 新建扩展表 unread_counts_staff(session_id, staff_id, unread_count, updated_at) |
| 缺外键约束（部分列 nullable） | 松散一致性 | owner_id / staff_id 允许 NULL | 低 | 保持灵活；若要强一致，可用触发器或应用层校验 |
| 健康检查粒度 | 仅列集合 | 未校验索引 & 外键 | 低 | 下一步扩展 PRAGMA index_list / foreign_key_list |

## 4. 建议迁移路线 (未来 3 步)
1. M1: messages 补齐软删除与元数据列
   - 添加列：is_deleted INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, read_at DATETIME NULL
   - 可选：metadata JSON / rich_content JSON（SQLite 原生无 JSON 类型，用 TEXT 存 JSON 字符串）
2. M2: 新增 unread_counts_staff 表（细粒度客服未读）
   - (id PK, session_id FK, staff_id FK, unread_count INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id, staff_id))
3. M3: sessions 增加 priority INTEGER DEFAULT 0（若确实需要调度队列）

## 5. 消息模块修复策略选择
| 方案 | 描述 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| A 补齐列 | 按实体现状新增列 | 代码最小修改 | 增加表宽 | 需要软删除/富内容功能 |
| B 裁剪实体 | 删除未使用字段 | 表保持精简 | 需要改动实体 + 序列化 | 短期不做富内容 |
| C 过渡支持 | 保留字段+ runtime feature flag | 渐进迁移 | 复杂度上升 | 分阶段部署大型集群 |

当前推荐：方案 A （直接补齐软删除与 read_at, updated_at；metadata/rich_content 视需求可延后）

## 6. 软删除/已读实现目标列 (建议)
| 列 | 类型 | 默认 | 说明 |
|----|------|------|------|
| is_deleted | INTEGER | 0 | 1=删除（软） |
| updated_at | DATETIME | CURRENT_TIMESTAMP | 行级更新时间 |
| read_at | DATETIME | NULL | 首次已读时间 |

## 7. 性能注意点
| 模块 | 潜在问题 | 优化建议 |
|------|----------|----------|
| dashboard stats | 聚合频繁 | 视高并发可加派生物化表或缓存层（定时刷新） |
| unread_counts | 更新写放大（消息量大） | 后期按 session/staff 粒度拆分，批量增量 flush |
| messages | 全表扫描旧消息 | 建立 (session_id, created_at DESC) 索引（已存在 session_id / created_at 独立索引，可考虑复合索引） |

## 8. 运维与回滚策略
- 基线迁移不可变；新增迁移失败 → 回滚到失败前的 DB 文件备份，修正迁移再执行
- 不支持列删除：通过“废弃+忽略”替代；真正需要清理时执行重建表脚本（需专门审核）

## 9. 健康检查下一步扩展草案
```rust
// 伪代码
fn check_indexes(db) { PRAGMA index_list(table); }
fn check_foreign_keys(db) { PRAGMA foreign_key_list(table); }
// 输出统一 JSON 结构 -> /api/admin/schema/health 可选内部接口
```

## 10. 最终结论
系统当前已回归到“单一真实来源”：Sea-ORM 迁移 + 实际 SQLite 表；残余差异仅在 messages 扩展字段与未来业务能力。按建议路线执行三步迁移后，可获得：软删除、已读精细化、优先级调度。健康检查可迭代增强对索引 & 外键覆盖。

---
维护建议优先级：
1. M1 补齐 messages 列（解消 repository 语义漂移）
2. 健康检查扩展索引 / 外键校验
3. unread_counts_staff 细粒度未读表
4. sessions priority（若产品确认需要）

若无异议，可据此创建下一批迁移文件。
