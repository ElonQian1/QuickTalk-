# 店铺接口（含未读统计）

本文档说明店铺相关的查询接口，包括老端点（向后兼容）与新增的带 total 的分页端点。

## 公共查询参数

- onlyActive / only_active: 是否只返回活跃店铺
  - 类型: boolean
  - 默认: true
- pageSize / limit: 返回的最大条数
  - 类型: integer
  - 默认: 50
  - 最大: 200
- skip / offset: 跳过的条数
  - 类型: integer
  - 默认: 0
  - 最小: 0

## 老端点（向后兼容）

- GET /api/shops
  - 说明: 店主查看自己店铺列表，返回 `ShopWithUnreadCount[]`
  - 支持查询参数: onlyActive, pageSize(limit), skip(offset)
- GET /api/staff/shops
  - 说明: 员工查看被加入的店铺列表，返回 `ShopWithUnreadCount[]`
  - 支持查询参数: onlyActive, pageSize(limit), skip(offset)

返回结构（示例）：

```json
[
  {
    "shop": {
      "id": 1,
      "owner_id": 1,
      "shop_name": "示例店铺",
      "shop_url": "https://example.com",
      "api_key": "...",
      "status": 1,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-02T00:00:00Z"
    },
    "unread_count": 12
  }
]
```

## 新端点（带 total 的分页）

- GET /api/shops/paged
  - 说明: 店主端分页接口，返回 `PageResult<ShopWithUnreadCount>`
  - 支持查询参数: onlyActive, pageSize(limit), skip(offset)
- GET /api/staff/shops/paged
  - 说明: 员工端分页接口，返回 `PageResult<ShopWithUnreadCount>`
  - 支持查询参数: onlyActive, pageSize(limit), skip(offset)

返回结构：

```json
{
  "items": [
    {
      "shop": { "id": 1, "owner_id": 1, "shop_name": "示例店铺", "shop_url": "https://example.com", "api_key": "...", "status": 1, "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-02T00:00:00Z" },
      "unread_count": 12
    }
  ],
  "total": 123,
  "limit": 50,
  "offset": 0
}
```

## 备注

- 未读数 `unread_count` 为真实数据库统计（`unread_counts` 表 `SUM(unread_count)`），并按未读数降序、`created_at` 次序排序。
- 默认仅返回活跃店铺（`is_active = 1`），可通过 `onlyActive=false` 查询全部。
- SQLx 使用编译期校验（`query_as!` / `query_scalar!`）并维护离线缓存，详见 `backend/.sqlx/README.md`。
