/**
 * 服务层迁移指南
 * 从传统架构迁移到 Controllers → Services → Repositories → Database 模式
 * 提供渐进式迁移策略，保证系统稳定性
 */

# 服务层架构迁移指南

## 🎯 迁移目标

将现有的直接仓库访问模式迁移到服务层架构：
- **传统模式**: Controllers → Repositories → Database
- **新架构**: Controllers → Services → Repositories → Database

## 📋 迁移检查清单

### Phase 1: 服务层基础设施 ✅
- [x] 创建 ServiceManager 管理所有服务
- [x] 创建 ServiceFactory 简化依赖注入
- [x] 创建 ServiceIntegration 实现渐进迁移
- [x] 创建服务层统一导出 (index.js)

### Phase 2: 核心业务服务 ✅
- [x] MessageService - 消息业务逻辑
- [x] ConversationService - 对话管理
- [x] ShopService - 店铺管理
- [x] NotificationService - 通知处理

### Phase 3: AI智能服务 ✅
- [x] KnowledgeBaseService - 知识库服务
- [x] IntentClassificationService - 意图识别
- [x] AutoReplyService - 自动回复

### Phase 4: 控制器和处理器迁移 🔄
- [x] MessageController - 新的消息控制器
- [x] MessageHandler-v2 - 更新版消息处理器
- [x] ConnectionHandler-v2 - 更新版连接处理器
- [x] WebSocketManager-v2 - 更新版WebSocket管理器
- [ ] 现有控制器的服务层集成

### Phase 5: 系统集成 🔄
- [ ] 更新 server.js 集成服务层
- [ ] 更新路由配置使用新控制器
- [ ] 更新WebSocket路由使用新管理器
- [ ] 配置服务层中间件

### Phase 6: 测试和验证 ⏳
- [ ] 单元测试覆盖
- [ ] 集成测试验证
- [ ] 性能测试对比
- [ ] 代码重复率验证 (<10%)

## 🚀 快速开始指南

### 1. 初始化服务层

```javascript
const { quickInitializeServices } = require('./src/services');

// 在 server.js 中初始化服务层
async function initializeServiceLayer() {
    const dependencies = {
        // 仓库层
        messageRepository: require('./src/database/message-repository'),
        shopRepository: require('./src/database/shop-repository'),
        
        // 外部服务
        webSocketManager: require('./src/websocket/WebSocketManager'),
        emailService: require('./src/utils/EmailService'),
        
        // 其他依赖...
    };
    
    const result = await quickInitializeServices(dependencies, 'development');
    return result;
}
```

### 2. Express应用集成

```javascript
const serviceLayer = await initializeServiceLayer();

// 添加服务中间件
app.use('/api', serviceLayer.middleware);

// 集成Express路由
serviceLayer.integration.integrateWithExpress(app);

// 集成WebSocket
serviceLayer.integration.integrateWithWebSocket(webSocketManager);
```

### 3. 使用新的控制器

```javascript
// 创建消息控制器
const MessageController = require('./src/controllers/MessageController');
const messageController = new MessageController(serviceLayer.serviceFactory.createContextForController('message'));

// 注册路由
const express = require('express');
const router = express.Router();
MessageController.createRoutes(router, messageController);
app.use('/api/v2', router);
```

## 🔧 渐进式迁移策略

### 策略1: 服务注入迁移

```javascript
// 现有处理器迁移
const MessageHandler = require('./src/client-api/message-handler');
const existingHandler = new MessageHandler(messageRepository, connectionHandler, securityLogger);

// 注入服务层
const services = serviceFactory.createContextForController('message');
MessageHandler.migrateToServices(existingHandler, services);
```

### 策略2: 兼容性适配器

```javascript
// 为旧代码提供新服务的访问接口
const ServiceIntegration = require('./src/services/ServiceIntegration');
const integration = new ServiceIntegration();
const compatibilityAdapter = integration.createCompatibilityAdapter();

// 旧代码可以继续使用
const result = await compatibilityAdapter.messageManager.sendMessage(data);
```

### 策略3: 双轨运行

```javascript
// 同时运行新旧系统，逐步切换
app.use('/api/v1', oldRoutes);     // 旧API
app.use('/api/v2', newRoutes);     // 新API（服务层）
app.use('/api/compat', compatRoutes); // 兼容性API
```

## 📊 迁移验证

### 代码重复率检测

```bash
# 安装代码重复检测工具
npm install -g jscpd

# 检测代码重复率
jscpd --threshold 10 --reporters html,console ./src

# 目标：代码重复率 < 10%
```

### 性能对比测试

```javascript
// 测试服务层性能
const { ServiceHelpers } = require('./src/services');
const performanceMonitor = ServiceHelpers.createPerformanceMonitor(serviceAccessor);

const { result, duration } = await performanceMonitor.measureServiceCall(
    'message', 
    'sendMessage', 
    messageData
);
```

### 健康检查

```javascript
// 服务层健康检查
const healthStatus = await serviceFactory.getHealthStatus();
console.log('服务层状态:', healthStatus);

// 集成健康检查
const integrationHealth = await integration.performHealthCheck();
console.log('集成状态:', integrationHealth);
```

## 🛠️ 故障排除

### 常见问题

1. **服务未初始化错误**
   ```javascript
   // 确保在使用前初始化服务
   if (!serviceFactory.initialized) {
       await serviceFactory.initialize(dependencies);
   }
   ```

2. **依赖注入失败**
   ```javascript
   // 检查依赖是否正确提供
   const { ServiceHelpers } = require('./src/services');
   ServiceHelpers.validateDependencies(dependencies);
   ```

3. **向后兼容性问题**
   ```javascript
   // 使用兼容性适配器
   const adapter = integration.createCompatibilityAdapter();
   // 或者使用迁移助手
   Handler.migrateToServices(existingHandler, services);
   ```

### 调试模式

```javascript
// 启用详细日志
const serviceLayer = await quickInitializeServices(dependencies, 'development');

// 监控服务调用
const stats = serviceFactory.getServiceStats();
console.log('服务统计:', stats);
```

## 📈 性能优化建议

### 1. 服务缓存
```javascript
// 在ServiceManager中启用缓存
const serviceManager = new ServiceManager(repositories, externalServices);
await serviceManager.initialize({
    enableCaching: true,
    cacheTimeout: 300000 // 5分钟
});
```

### 2. 连接池优化
```javascript
// 数据库连接池配置
const dependencies = {
    repositories: {
        messageRepository: new MessageRepository({
            poolSize: 10,
            poolTimeout: 30000
        })
    }
};
```

### 3. 异步处理
```javascript
// 使用异步通知
await notificationService.notifyNewMessage(data, { async: true });
```

## 🎯 最佳实践

### 1. 服务边界清晰
- 每个服务职责单一
- 避免跨服务直接调用
- 通过事件或消息传递通信

### 2. 错误处理一致
```javascript
// 统一错误处理模式
try {
    const result = await messageService.sendMessage(data);
} catch (error) {
    if (error instanceof ValidationError) {
        // 处理验证错误
    } else if (error instanceof AuthenticationError) {
        // 处理认证错误
    } else {
        // 处理其他错误
    }
}
```

### 3. 测试友好设计
```javascript
// 使用依赖注入便于测试
class MessageService {
    constructor(messageRepository, notificationService) {
        this.messageRepository = messageRepository;
        this.notificationService = notificationService;
    }
}

// 测试时可以注入模拟对象
const mockRepository = { create: jest.fn() };
const service = new MessageService(mockRepository, mockNotificationService);
```

## 📝 迁移时间表

### Week 1: 基础设施
- ✅ 服务层框架搭建
- ✅ 核心服务实现

### Week 2: 控制器迁移  
- 🔄 现有控制器服务层集成
- 🔄 API路由更新

### Week 3: 系统集成
- ⏳ server.js 集成
- ⏳ WebSocket集成
- ⏳ 中间件配置

### Week 4: 测试验证
- ⏳ 功能测试
- ⏳ 性能测试
- ⏳ 代码质量验证

## 🏁 完成标准

迁移完成的标准：
1. ✅ 所有新服务正常运行
2. 🔄 现有功能完整保留
3. ⏳ 代码重复率 < 10%
4. ⏳ 性能无明显退化
5. ⏳ 测试覆盖率 > 80%
6. ⏳ 文档完整更新

---

**注意**: 这是一个渐进式迁移过程，确保在每个阶段都进行充分测试，避免影响生产环境的稳定性。