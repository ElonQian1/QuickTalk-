# 目录重构规划 (2025-09-24)

本规划用于将当前根目录遗留的 `domain/`、`presentation/`、`static/` 等分散资源迁移到符合项目约束的 **单一纯 Rust + 静态资源** 结构，并与逐步引入的 DDD 分层保持一致。

## 现状摘要
| 顶层目录 | 角色 | 问题 | 处理策略 |
|----------|------|------|----------|
| `domain/` | 旧版领域模型(部分Rust模块结构外) | 与 `backend/src/domain` 重复、位置不合规 | 归并或标记废弃；逐文件评估是否迁入 `backend/src/domain` |
| `presentation/static/` | 大量实验/调试/测试 HTML/JS | 混杂生产与实验文件，命名冗余 | 筛选：保留必要页面迁入 `static/`，其余归档 `static/archive/` |
| `static/` (根) | 单一 `admin-new.html` | 目的不清晰 | 与正式 UI 对比后合并或归档 |
| `services/` | 之前已清理 Node.js 子目录 | 目录空或仅 uploads | 计划移除或并入统一 uploads 体系 |

## 目标状态 (Target State)

```
backend/
  src/
    domain/                # 领域层（聚合/实体/值对象/服务）
    application/           # 用例 (Use Cases)
    api/                   # 接口适配层 (HTTP/WS handlers)
    db/                    # 基础设施实现 (SQLx repos)
    web/                   # 静态文件路由与页面入口分发
static/                    # 生产级静态资源（精简、命名清晰）
  css/
  js/
  assets/
  index.html
  admin.html
  mobile-admin.html
static/archive/            # 历史/实验/测试页面 (只读，不随部署打包)
docs/
  RESTRUCTURE_PLAN.md
  ...
```

## 迁移分阶段
### Phase 1 - 清点与分类 (已进行)
- [x] 移除 Node.js 运行环境相关 artefacts (package.json / node_modules / migrate scripts)。
- [x] 统一数据库文件 quicktalk.sqlite。

### Phase 2 - 分类规则
| 类型 | 识别特征 | 去向 |
|------|----------|------|
| 正式入口页面 | index / admin / mobile / chat 主工作流 | `static/` 根或子目录 |
| 调试/测试页面 | 含 test / debug / demo / generator / fix 字样 | `static/archive/` |
| 试验版 UI | 重复的 admin/mobile 多变体 | 仅保留最新稳定版，其余归档 |
| JS 逻辑文件 | websocket管理 / 消息管理 / 上传功能 | 汇总重命名至 `static/js/` |

### Phase 3 - 执行迁移 (计划)
1. 创建 `static/archive/` 并批量移动测试/调试页面。
2. 确定主页面集合：`index.html`, `admin-mobile.html`（或重命名为 `admin.html`）, `mobile-dashboard.html` 等。
3. 合并重复 CSS / 去除未引用的脚本。
4. 为关键脚本补充头部注释（模块职责、依赖、事件）。

### Phase 4 - 领域目录归并
1. 分析根级 `domain/` 子目录：`conversation/`, `customer/`, `message/`, `shop/`。
2. 若存在与 `backend/src/domain` 已实现功能重复：
   - 对比差异，提取仍需迁移的结构（如更强类型 ID、新的不变式）。
   - 采用 newtype ID 与聚合封装方式重写或合并。
3. 添加 `README` 于 `backend/src/domain` 说明建模策略与迁移进度。

### Phase 5 - 验证与文档
1. 全局 grep 确认无引用根级 `domain/`。
2. 移除空目录或标记 `domain/` → `domain-legacy/`（若仍需人工对比）。
3. 更新 `README-RUST-PURE.md` “项目结构” 章节。

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 页面误删 | 功能缺失 | 先归档，不直接物理删除 |
| 领域模型差异 | 行为回归 | 编写对比备注与最小测试 (领域层纯函数测试) |
| JS 依赖顺序变化 | 前端运行错误 | 引入 `static/js/entry-order.md` 指定加载顺序 |

## 执行顺序建议 (可与 CI 集成)
1. 归档测试/调试页面
2. 精简生产页面集合
3. 合并/迁移根级 domain -> backend/src/domain
4. 添加领域层单元测试 (聚合不变式)
5. 文档与 README 更新
6. CI 脚本：检测禁止再次出现 package.json / node_modules

## 即将创建的附加文件
- `static/archive/README.md`
- `backend/src/domain/README.md`
- `scripts/verify-pure-rust.sh` (可选)

---
本规划文件将随着迁移进度更新。若发现新遗留模式，请追加到 “风险与缓解” 区块。
