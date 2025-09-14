# QuickTalk 客服系统用户指南

## 📚 目录

1. [快速开始](#快速开始)
2. [客户端集成](#客户端集成)
3. [管理后台使用](#管理后台使用)
4. [店铺管理](#店铺管理)
5. [移动端支持](#移动端支持)
6. [高级功能](#高级功能)
7. [常见问题](#常见问题)
8. [技术支持](#技术支持)

## 快速开始

### 系统要求
- Node.js 14.0 或更高版本
- 现代浏览器（Chrome 70+、Firefox 65+、Safari 12+、Edge 79+）
- 至少 512MB 可用内存
- 至少 100MB 磁盘空间

### 安装和启动

#### 1. 下载源码
```bash
git clone https://github.com/your-org/quicktalk.git
cd quicktalk
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 启动系统
```bash
# 开发模式（支持热重载）
npm run dev

# 生产模式
npm start
```

#### 4. 访问系统
- 客服系统: http://localhost:3030
- 管理后台: http://localhost:3030/admin
- 测试页面: http://localhost:3030/tests/test-runner.html

### 初始配置

#### 1. 创建管理员账号
首次启动时，系统会自动创建默认管理员账号：
- 用户名: `admin`
- 密码: `admin123`

⚠️ **重要**: 请在首次登录后立即修改默认密码！

#### 2. 基础设置
登录管理后台后，进入"系统设置"完成以下配置：
- 系统名称和描述
- 邮件服务器设置（用于通知）
- 文件上传设置
- 安全设置

## 客户端集成

### 一键集成代码

QuickTalk 提供了简单的一键集成方案，只需在您的网站中添加以下代码：

```html
<!-- 在 </head> 标签前添加 -->
<link rel="stylesheet" href="https://your-domain.com/integration/styles.css">

<!-- 在 </body> 标签前添加 -->
<script>
(function() {
    var script = document.createElement('script');
    script.src = 'https://your-domain.com/integration/quicktalk.js';
    script.async = true;
    script.onload = function() {
        QuickTalk.init({
            apiKey: 'YOUR_API_KEY',
            shopId: 'YOUR_SHOP_ID',
            position: 'bottom-right',  // 显示位置
            theme: 'light',            // 主题色彩
            autoOpen: false,           // 是否自动打开
            language: 'zh-CN'          // 界面语言
        });
    };
    document.head.appendChild(script);
})();
</script>
```

### 高级集成选项

#### 自定义样式
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    customStyles: {
        primaryColor: '#007bff',      // 主色调
        fontFamily: 'Arial, sans-serif', // 字体
        borderRadius: '8px',          // 圆角
        chatWindowWidth: '400px',     // 聊天窗口宽度
        chatWindowHeight: '600px'     // 聊天窗口高度
    }
});
```

#### 事件监听
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    onReady: function() {
        console.log('客服系统初始化完成');
    },
    onOpen: function() {
        console.log('客服窗口已打开');
    },
    onClose: function() {
        console.log('客服窗口已关闭');
    },
    onMessage: function(message) {
        console.log('收到新消息:', message);
    }
});
```

#### 用户信息预填充
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    userInfo: {
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '13800138000',
        customFields: {
            vipLevel: 'gold',
            orderCount: 15
        }
    }
});
```

### API 控制

#### 程序化控制聊天窗口
```javascript
// 打开聊天窗口
QuickTalk.open();

// 关闭聊天窗口
QuickTalk.close();

// 发送预设消息
QuickTalk.sendMessage('我想了解产品详情');

// 更新用户信息
QuickTalk.updateUser({
    name: '新用户名',
    email: 'newemail@example.com'
});

// 设置自定义数据
QuickTalk.setCustomData({
    currentPage: window.location.href,
    referrer: document.referrer
});
```

### 响应式设计

客服窗口会自动适配不同屏幕尺寸：

- **桌面端** (>768px): 右下角浮动窗口
- **平板端** (768px-1024px): 适中尺寸窗口
- **手机端** (<768px): 全屏模式

可以通过配置强制使用特定模式：
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    responsive: {
        mobile: 'fullscreen',    // 手机端强制全屏
        tablet: 'windowed',      // 平板端窗口模式
        desktop: 'floating'      // 桌面端浮动模式
    }
});
```

## 管理后台使用

### 登录管理后台

1. 访问 `http://your-domain.com/admin`
2. 输入管理员用户名和密码
3. 点击"登录"按钮

### 对话管理

#### 实时对话监控
- **对话列表**: 查看所有进行中和历史对话
- **实时状态**: 绿色表示在线，灰色表示离线
- **未读提醒**: 红色数字标识未读消息数量

#### 消息处理
1. **快速回复**: 点击对话项进入详情页面
2. **消息输入**: 在底部输入框输入回复内容
3. **发送消息**: 按回车键或点击发送按钮
4. **文件发送**: 点击附件按钮上传文件

#### 对话操作
- **标记重要**: 为重要对话添加星号标记
- **分配客服**: 将对话分配给特定客服人员
- **添加备注**: 为对话添加内部备注
- **结束对话**: 手动结束已完成的对话

### 客服人员管理

#### 添加客服人员
1. 进入"用户管理" → "客服人员"
2. 点击"添加客服"按钮
3. 填写基本信息：
   - 姓名
   - 邮箱
   - 电话
   - 角色权限
4. 设置工作时间和技能标签
5. 点击"保存"完成添加

#### 权限设置
- **超级管理员**: 所有权限
- **主管**: 店铺管理、人员管理、数据统计
- **客服**: 对话处理、客户管理
- **只读**: 仅查看权限

#### 排班管理
1. 进入"客服管理" → "排班设置"
2. 选择客服人员和日期
3. 设置工作时段
4. 保存排班信息

### 数据统计

#### 对话统计
- **今日对话**: 当日对话总数和处理情况
- **响应时间**: 平均首次响应时间
- **解决率**: 问题解决成功率
- **满意度**: 客户满意度评分

#### 客服绩效
- **处理量**: 每个客服的对话处理数量
- **响应速度**: 平均响应时间排名
- **在线时长**: 每日在线工作时间
- **客户评价**: 客户对客服的评价统计

#### 数据导出
1. 选择统计时间范围
2. 选择要导出的数据类型
3. 选择导出格式（Excel、CSV、PDF）
4. 点击"导出"按钮下载文件

## 店铺管理

### 申请开通服务

#### 在线申请
1. 访问注册页面
2. 填写店铺基本信息：
   - 店铺名称
   - 网站域名
   - 联系邮箱
   - 联系电话
   - 店铺类型
3. 提交申请等待审核

#### 审核流程
1. **自动验证**: 系统自动验证域名和邮箱
2. **人工审核**: 管理员审核店铺资质
3. **审核通过**: 发送集成代码和API密钥
4. **开始使用**: 接入客服系统

### 店铺设置

#### 基础设置
- **店铺信息**: 名称、描述、联系方式
- **域名绑定**: 授权使用的域名列表
- **营业时间**: 客服服务时间设置
- **欢迎语**: 客户打开聊天时的欢迎消息

#### 外观定制
- **主题色彩**: 选择符合品牌的颜色方案
- **Logo上传**: 上传店铺Logo显示在聊天窗口
- **位置设置**: 聊天按钮在网页中的显示位置
- **动画效果**: 开启或关闭动画效果

#### 功能配置
- **自动回复**: 设置常见问题的自动回复
- **文件上传**: 允许客户上传文件类型
- **离线留言**: 非营业时间的留言功能
- **满意度评价**: 对话结束后的评价功能

### 集成代码生成

#### 获取集成代码
1. 登录店铺管理后台
2. 进入"集成设置"页面
3. 选择集成方式：
   - 标准集成（推荐）
   - 高级集成
   - API集成
4. 复制生成的代码到网站

#### 代码自定义
```javascript
// 基础集成代码
<script>
(function() {
    // 配置参数
    var config = {
        apiKey: 'YOUR_API_KEY',
        shopId: 'YOUR_SHOP_ID',
        // 自定义参数
        position: 'bottom-right',    // bottom-left, top-right, top-left
        theme: 'light',              // light, dark, auto
        showOnPages: ['*'],          // 显示页面，'*' 表示所有页面
        hideOnPages: [],             // 隐藏页面
        triggerDelay: 3000,          // 延迟显示时间（毫秒）
        autoGreeting: true,          // 自动显示欢迎语
        offlineMessage: '客服暂时不在线，请留言' // 离线提示
    };
    
    // 加载客服系统
    var script = document.createElement('script');
    script.src = 'https://your-domain.com/integration/quicktalk.js';
    script.async = true;
    script.onload = function() {
        window.QuickTalk.init(config);
    };
    document.head.appendChild(script);
})();
</script>
```

### API密钥管理

#### 生成API密钥
1. 进入"开发者设置" → "API密钥"
2. 点击"生成新密钥"
3. 设置密钥权限和过期时间
4. 保存并记录密钥（仅显示一次）

#### 密钥权限
- **读取权限**: 获取对话和消息信息
- **写入权限**: 发送消息和创建对话
- **管理权限**: 管理店铺设置和用户
- **完全权限**: 所有操作权限

#### 安全建议
- 定期轮换API密钥
- 不要在前端代码中暴露密钥
- 使用HTTPS确保传输安全
- 监控API调用日志

## 移动端支持

### 自动适配

QuickTalk 自动检测设备类型并适配界面：

#### 手机端特性
- **全屏聊天**: 聊天窗口占满整个屏幕
- **触摸优化**: 按钮和输入框针对触摸操作优化
- **手势支持**: 支持下拉刷新、滑动关闭等手势
- **键盘适配**: 自动调整界面避免键盘遮挡

#### 平板端特性
- **适中尺寸**: 聊天窗口适合平板屏幕尺寸
- **横竖屏适配**: 自动适应屏幕方向变化
- **多点触控**: 支持双指缩放等操作

### 移动端专用功能

#### 语音消息
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    features: {
        voiceMessage: true,        // 启用语音消息
        voiceMaxDuration: 60,      // 最大录音时长（秒）
        voiceAutoPlay: true        // 自动播放收到的语音
    }
});
```

#### 图片拍照
- **相机拍照**: 直接调用摄像头拍照
- **相册选择**: 从相册选择图片
- **图片压缩**: 自动压缩减少流量消耗

#### 位置分享
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    features: {
        locationSharing: true,     // 启用位置分享
        mapProvider: 'baidu'       // 地图提供商: baidu, google, amap
    }
});
```

### 性能优化

#### 流量节省
- **图片压缩**: 自动压缩上传图片
- **懒加载**: 按需加载历史消息
- **数据缓存**: 缓存常用数据减少请求

#### 电池优化
- **后台限制**: 应用转入后台时降低更新频率
- **连接管理**: 智能管理WebSocket连接
- **动画控制**: 在低电量时减少动画效果

## 高级功能

### 自动化规则

#### 自动分配
```javascript
// 配置自动分配规则
{
    autoAssignment: {
        enabled: true,
        rules: [
            {
                condition: 'vipLevel === "gold"',
                assignTo: 'senior-agent',
                priority: 1
            },
            {
                condition: 'language === "en"',
                assignTo: 'english-agent',
                priority: 2
            }
        ]
    }
}
```

#### 智能回复
- **关键词匹配**: 根据关键词自动回复
- **意图识别**: 识别客户意图提供相应回复
- **FAQ匹配**: 自动匹配常见问题答案

#### 工作流程
1. **触发条件**: 设置自动化的触发条件
2. **执行动作**: 定义要执行的动作
3. **通知规则**: 设置相关人员的通知方式

### 集成第三方系统

#### CRM系统集成
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    integrations: {
        crm: {
            type: 'salesforce',      // 或 'hubspot', 'custom'
            apiKey: 'CRM_API_KEY',
            syncCustomers: true,     // 同步客户信息
            syncConversations: true  // 同步对话记录
        }
    }
});
```

#### 电商平台集成
- **订单信息**: 自动获取客户订单信息
- **产品推荐**: 根据浏览记录推荐产品
- **支付状态**: 实时显示订单和支付状态

#### 数据分析工具
- **Google Analytics**: 集成GA跟踪客服互动
- **百度统计**: 统计客服系统使用情况
- **自定义埋点**: 发送自定义事件数据

### 高级安全功能

#### 数据加密
- **传输加密**: 所有数据采用HTTPS/WSS加密传输
- **存储加密**: 敏感数据采用AES加密存储
- **端到端加密**: 可选的端到端消息加密

#### 访问控制
```javascript
QuickTalk.init({
    apiKey: 'YOUR_API_KEY',
    shopId: 'YOUR_SHOP_ID',
    security: {
        ipWhitelist: ['192.168.1.*'],    // IP白名单
        rateLimit: {
            requests: 100,               // 每分钟最大请求数
            window: 60000               // 时间窗口（毫秒）
        },
        domainRestriction: true,         // 严格域名验证
        sessionTimeout: 3600000          // 会话超时时间
    }
});
```

#### 审计日志
- **操作记录**: 记录所有用户操作
- **登录日志**: 记录登录尝试和结果
- **API调用**: 记录所有API调用详情
- **数据变更**: 记录数据修改历史

## 常见问题

### 集成问题

**Q: 集成代码添加后没有显示客服按钮？**

A: 请检查以下几点：
1. 确认API Key和Shop ID正确
2. 检查浏览器控制台是否有错误
3. 确认网站域名已在后台授权
4. 检查网络连接是否正常

**Q: 聊天窗口显示但无法发送消息？**

A: 可能的原因：
1. WebSocket连接失败，检查网络环境
2. 服务器维护中，稍后重试
3. API权限不足，联系管理员
4. 浏览器版本过旧，请升级浏览器

### 功能问题

**Q: 移动端界面显示异常？**

A: 解决方案：
1. 检查viewport meta标签设置
2. 确认CSS样式没有冲突
3. 测试不同浏览器兼容性
4. 查看是否启用了响应式模式

**Q: 离线消息没有收到？**

A: 检查项目：
1. 确认邮件服务器配置正确
2. 检查垃圾邮件文件夹
3. 验证邮箱地址有效性
4. 查看系统通知设置

### 性能问题

**Q: 聊天窗口加载缓慢？**

A: 优化建议：
1. 启用CDN加速
2. 压缩静态资源
3. 减少第三方脚本冲突
4. 优化网络环境

**Q: 消息发送延迟严重？**

A: 可能原因：
1. 网络延迟较高
2. 服务器负载过高
3. WebSocket连接不稳定
4. 客户端性能不足

### 安全问题

**Q: 如何保护API密钥安全？**

A: 安全措施：
1. 不要在前端代码中暴露密钥
2. 使用服务器端代理API调用
3. 定期轮换API密钥
4. 监控异常API调用

**Q: 如何防止恶意用户攻击？**

A: 防护策略：
1. 启用请求频率限制
2. 配置IP白名单
3. 使用HTTPS加密传输
4. 定期更新系统版本

## 技术支持

### 联系方式
- **技术支持邮箱**: support@quicktalk.com
- **技术支持QQ群**: 123456789
- **在线文档**: https://docs.quicktalk.com
- **GitHub仓库**: https://github.com/your-org/quicktalk

### 获取帮助

#### 提交问题前请准备
1. 问题详细描述
2. 错误截图或日志
3. 浏览器和版本信息
4. 集成代码配置
5. 复现步骤

#### 问题分类
- **🐛 Bug报告**: 系统功能异常
- **💡 功能建议**: 新功能需求
- **❓ 使用咨询**: 使用方法询问
- **🔧 技术支持**: 集成技术问题

#### 响应时间
- **严重问题**: 2小时内响应
- **一般问题**: 24小时内响应
- **功能建议**: 72小时内响应

### 更新日志

查看最新更新和功能变更：
- [版本更新日志](./CHANGELOG.md)
- [API变更说明](./API_CHANGES.md)
- [已知问题列表](./KNOWN_ISSUES.md)

### 社区资源

- **用户论坛**: https://forum.quicktalk.com
- **视频教程**: https://video.quicktalk.com
- **最佳实践**: https://best-practices.quicktalk.com
- **开发者博客**: https://blog.quicktalk.com

---

**感谢使用 QuickTalk 客服系统！**

如有任何问题或建议，欢迎随时联系我们的技术支持团队。