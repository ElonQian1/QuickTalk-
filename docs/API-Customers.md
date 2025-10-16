# 客户接口（Customers）

本文档介绍客户列表相关接口，包含老端点（向后兼容）与新分页端点（带 total 与关键字搜索）。

## 通用参数

- limit / pageSize: 每页条数（默认 50，最大 200）
- offset / skip: 跳过的条数（默认 0）
- q / keyword: 关键字搜索（可选），匹配字段：customer_name / customer_email / customer_id

## 老端点（向后兼容）

- GET `/api/shops/:shop_id/customers`
  - 说明：返回 `CustomerWithSession[]`
  - 默认按 `last_active_at` 降序
  - 权限：需为店铺成员

返回示例：

```json
[
  {
    "customer": {
      "id": 1,
      "shop_id": 123,
      "customer_id": "c-001",
      "customer_name": "Alice",
      "customer_email": "alice@example.com",
      "customer_avatar": null,
      "ip_address": "1.2.3.4",
      "user_agent": "Mozilla/5.0",
      "first_visit_at": "2025-01-01T00:00:00Z",
      "last_active_at": "2025-01-02T00:00:00Z",
      "status": 1
    },
    "session": { "id": 10, "shop_id": 123, "customer_id": 1, "staff_id": null, "session_status": "active", "created_at": "2025-01-02T00:00:00Z", "closed_at": null, "last_message_at": "2025-01-02T00:05:00Z" },
    "last_message": null,
    "unread_count": 0
  }
]
```

## 新端点：分页 + Total + 搜索

- GET `/api/shops/:shop_id/customers/paged?limit=50&offset=0&q=alice`
  - 说明：返回 `PageResult<CustomerWithSession>`
  - 权限：需为店铺成员
  - 搜索：对 `customer_name` / `customer_email` / `customer_id` 进行包含匹配
  - 默认排序：`last_active_at` 降序

返回示例：

```json
{
  "items": [
    {
      "customer": { "id": 1, "shop_id": 123, "customer_id": "c-001", "customer_name": "Alice", "customer_email": "alice@example.com", "customer_avatar": null, "ip_address": "1.2.3.4", "user_agent": "Mozilla/5.0", "first_visit_at": "2025-01-01T00:00:00Z", "last_active_at": "2025-01-02T00:00:00Z", "status": 1 },
      "session": { "id": 10, "shop_id": 123, "customer_id": 1, "staff_id": null, "session_status": "active", "created_at": "2025-01-02T00:00:00Z", "closed_at": null, "last_message_at": "2025-01-02T00:05:00Z" },
      "last_message": { "id": 99, "session_id": 10, "sender_type": "customer", "sender_id": 1, "content": "Hi", "message_type": "text", "file_url": null, "file_name": null, "status": "active", "created_at": "2025-01-02T00:05:00Z" },
      "unread_count": 2
    }
  ],
  "total": 123,
  "limit": 50,
  "offset": 0
}
```

## 备注

- 分页与 total 均基于真实数据库数据统计，不使用 mock。
- 如需按“未读优先/最近消息时间”等排序，可在后续扩展 `sort` 参数（当涉及跨表聚合时，可能需要使用 SQLx 宏查询或视图以保证性能与可维护性）。
