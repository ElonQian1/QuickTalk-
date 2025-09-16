# QuickTalk 客服系统 - 文件组织规范

## 📁 项目结构总览

```
QuickTalk-/
├── static/                          # 静态资源根目录
│   ├── production/                  # 生产环境文件 🚀
│   │   ├── admin/                  # 管理后台
│   │   ├── customer/               # 客户端
│   │   └── shared/                 # 共享组件
│   ├── development/                 # 开发环境文件 🔧
│   │   ├── demos/                  # 功能演示
│   │   ├── tests/                  # 测试文件
│   │   └── docs/                   # 开发文档
│   ├── assets/                      # 静态资源 📦
│   │   ├── css/                    # 样式系统
│   │   ├── js/                     # 脚本系统
│   │   ├── images/                 # 图片资源
│   │   └── fonts/                  # 字体文件
│   └── lib/                        # 第三方依赖 📚
├── src/                            # 后端源码
├── docs/                           # 项目文档
└── tests/                          # 测试文件
```

## 🎨 CSS架构规范

### 目录结构
```
static/assets/css/
├── master.css                      # 主入口文件
├── base/                           # 基础样式
│   ├── foundation.css              # CSS重置和基础设置
│   ├── global.css                  # 全局样式变量
│   ├── main.css                    # 主要样式定义
│   └── responsive.css              # 响应式断点
├── components/                     # 组件样式
│   ├── button.css                  # 按钮组件
│   ├── form.css                    # 表单组件
│   ├── modal.css                   # 模态框组件
│   ├── navigation.css              # 导航组件
│   ├── notification.css            # 通知组件
│   └── integration-manager.css     # 集成管理器
├── pages/                          # 页面特定样式
│   ├── analytics-dashboard.css     # 分析仪表板
│   ├── ai-assistant.css            # AI助手页面
│   ├── mobile-customer.css         # 移动客户端
│   └── [其他页面样式]
├── modules/                        # 功能模块样式
│   └── ruilong-features/           # Ruilong特性模块
└── themes/                         # 主题样式
    └── default.css                 # 默认主题
```

### 命名规范
- **文件命名**: 小写字母 + 连字符 (`kebab-case`)
- **类名**: BEM命名法 (`.block__element--modifier`)
- **变量**: CSS自定义属性 (`--primary-color`)

### 样式导入顺序
```css
/* 1. 基础样式 */
@import url('./base/foundation.css');
@import url('./base/global.css');

/* 2. 组件样式 */
@import url('./components/button.css');

/* 3. 页面样式 (按需加载) */
/* @import url('./pages/analytics.css'); */

/* 4. 主题样式 */
@import url('./themes/default.css');
```

## ⚙️ JavaScript架构规范

### 目录结构
```
static/assets/js/
├── core/                           # 核心工具
│   ├── utils.js                    # 统一工具函数
│   ├── api.js                      # API接口管理
│   ├── config.js                   # 配置管理
│   └── constants.js                # 常量定义
├── modules/                        # 业务模块
│   ├── message/                    # 消息管理模块
│   │   ├── index.js               # 模块入口
│   │   ├── search-manager.js      # 消息搜索
│   │   ├── mobile-manager.js      # 移动端消息
│   │   └── unified-manager.js     # 统一消息管理
│   ├── shop/                       # 店铺管理模块
│   │   ├── index.js               # 模块入口
│   │   ├── mobile-manager.js      # 移动店铺管理
│   │   └── ecommerce-service.js   # 电商服务
│   ├── analytics/                  # 分析模块
│   ├── ai/                         # AI功能模块
│   ├── mobile/                     # 移动端模块
│   └── admin/                      # 管理功能模块
├── components/                     # UI组件
│   ├── button.js                   # 按钮组件
│   ├── modal.js                    # 模态框组件
│   ├── form.js                     # 表单组件
│   └── notification.js             # 通知组件
├── pages/                          # 页面脚本
│   ├── admin/                      # 管理页面脚本
│   ├── customer/                   # 客户页面脚本
│   └── mobile/                     # 移动页面脚本
├── services/                       # 服务层
│   ├── auth.js                     # 认证服务
│   ├── websocket.js                # WebSocket服务
│   └── storage.js                  # 存储服务
└── lib/                           # 第三方库
    └── vendor/                     # 供应商库
```

### 模块规范
```javascript
// 模块入口文件 (index.js)
export { default as SearchManager } from './search-manager.js';
export { default as MobileManager } from './mobile-manager.js';
export { default as UnifiedManager } from './unified-manager.js';

// 具体模块文件
class MessageSearchManager {
    constructor(options = {}) {
        this.options = { ...defaultOptions, ...options };
    }
    
    // 模块方法
    search(query) {
        // 实现
    }
}

export default MessageSearchManager;
```

### 依赖管理
- 使用ES6模块 (`import/export`)
- 避免全局变量，使用模块化导入
- 建立清晰的依赖关系图

## 📄 HTML文件组织

### 文件分类
```
static/
├── production/                     # 生产文件
│   ├── admin/                     # 管理后台页面
│   │   ├── dashboard.html         # 管理仪表板
│   │   ├── analytics.html         # 分析页面
│   │   └── mobile.html            # 移动管理界面
│   ├── customer/                  # 客户端页面
│   │   ├── index.html             # 客户主页
│   │   └── chat.html              # 聊天界面
│   └── shared/                    # 共享页面
│       └── error.html             # 错误页面
├── development/                   # 开发文件
│   ├── demos/                     # 演示页面
│   │   ├── ai-assistant-demo.html
│   │   ├── notification-demo.html
│   │   └── file-manager-demo.html
│   └── tests/                     # 测试页面
│       ├── unit-test.html
│       └── integration-test.html
└── templates/                     # 模板文件
    ├── base.html                  # 基础模板
    └── components/                # 组件模板
```

### HTML结构规范
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面标题 - QuickTalk客服系统</title>
    
    <!-- CSS资源 -->
    <link rel="stylesheet" href="/static/assets/css/master.css">
    <link rel="stylesheet" href="/static/assets/css/pages/specific-page.css">
</head>
<body>
    <main id="app">
        <!-- 页面内容 -->
    </main>
    
    <!-- JavaScript资源 -->
    <script src="/static/assets/js/core/utils.js"></script>
    <script src="/static/assets/js/pages/specific-page.js"></script>
</body>
</html>
```

## 📦 文件命名规范

### 通用规则
- 使用小写字母和连字符 (`kebab-case`)
- 避免特殊字符和空格
- 使用描述性名称，避免缩写

### 具体规范
| 文件类型 | 命名格式 | 示例 |
|---------|----------|------|
| HTML页面 | `功能-类型.html` | `admin-dashboard.html` |
| CSS样式 | `组件/页面名.css` | `button.css`, `mobile-customer.css` |
| JavaScript | `功能-管理器.js` | `message-manager.js` |
| 图片资源 | `类型-描述.扩展名` | `icon-close.svg` |
| 字体文件 | `字体名-变体.扩展名` | `roboto-regular.woff2` |

## 🔧 开发工作流

### 新功能开发
1. **创建功能分支**: `feature/新功能名`
2. **文件组织**: 按模块放入相应目录
3. **命名检查**: 确保符合命名规范
4. **依赖管理**: 明确模块依赖关系
5. **文档更新**: 更新相关文档

### 文件修改流程
1. **位置确认**: 确认文件在正确目录
2. **影响分析**: 分析修改对其他模块的影响
3. **测试验证**: 确保修改不破坏现有功能
4. **文档同步**: 同步更新相关文档

## 📋 代码质量标准

### CSS质量要求
- 使用一致的缩进 (2个空格)
- 属性按逻辑分组排列
- 使用CSS自定义属性管理颜色和尺寸
- 避免重复样式，提取公共类

### JavaScript质量要求
- 使用ES6+语法特性
- 遵循统一的代码格式 (Prettier)
- 使用JSDoc注释
- 避免全局变量污染

### HTML质量要求
- 语义化标签使用
- 无障碍访问支持
- SEO友好的结构
- 合理的标签嵌套

## 🚀 部署和构建

### 生产环境部署
- 只部署 `static/production/` 目录下的文件
- CSS和JavaScript文件压缩
- 图片资源优化
- 启用缓存策略

### 开发环境配置
- 包含所有 `static/development/` 文件
- 启用源代码映射
- 热重载支持
- 详细错误信息

## 📚 维护指南

### 定期维护任务
1. **依赖检查**: 检查模块依赖关系
2. **重复清理**: 清理重复和未使用的文件
3. **性能优化**: 优化资源加载性能
4. **文档更新**: 保持文档与代码同步

### 问题排查
1. **文件定位**: 使用目录结构快速定位文件
2. **依赖追踪**: 通过模块入口文件追踪依赖
3. **版本控制**: 使用Git历史追踪变更
4. **日志分析**: 使用浏览器开发工具分析问题

---

> **注意**: 此规范是QuickTalk客服系统的核心组织原则，所有团队成员都应遵循这些规范以确保项目的可维护性和一致性。

*最后更新: 2025年9月16日*