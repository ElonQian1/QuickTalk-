# SQLx 离线缓存

此目录存放 SQLx 编译期校验所需的查询缓存（offline data）。

用途：
- 让 `sqlx::query! / query_as! / query_scalar!` 等宏在 CI / 交叉编译（无数据库可连接）时依然能通过类型校验。

更新方法（Windows PowerShell）：

```powershell
# 确保 DATABASE_URL 指向真实数据库文件
pwsh -NoProfile -File backend/scripts/prepare-sqlx.ps1
```

注意：
- 修改或新增 SQLx 宏查询后，请务必重新执行上面的命令以刷新缓存。
- 建议把 `backend/.sqlx/` 与根目录生成的 `sqlx-data.json` 一并提交到版本库，确保 CI 稳定。
