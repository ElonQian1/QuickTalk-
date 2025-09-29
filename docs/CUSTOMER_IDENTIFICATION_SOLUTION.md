# 客户标识和会话持久化解决方案

## 🎯 问题描述

1. **客户命名问题**: 当前客户消息栏显示为"客户 + customer_id"，需要改为按客户人数排序的编号格式（客户001、客户767等）
2. **会话持久化问题**: 客户端刷新页面就变成新的消息入口，导致会话不连续

## 🔧 解决方案

### 1. 客户编号生成系统

#### 前端实现
在管理后台中添加了 `generateCustomerNumber()` 函数：

```javascript
generateCustomerNumber(customerId) {
    // 尝试从缓存获取客户编号映射
    let customerNumberMap = JSON.parse(localStorage.getItem('customer_number_map') || '{}');
    
    if (customerNumberMap[customerId]) {
        return customerNumberMap[customerId];
    }
    
    // 生成新的客户编号（基于已有客户数量 + 1）
    let nextNumber = Object.keys(customerNumberMap).length + 1;
    let formattedNumber = `客户${String(nextNumber).padStart(3, '0')}`;
    
    // 保存映射关系
    customerNumberMap[customerId] = formattedNumber;
    localStorage.setItem('customer_number_map', JSON.stringify(customerNumberMap));
    
    return formattedNumber;
}
```

#### 应用位置
- 对话列表渲染：`renderConversationsList()`
- 对话选择：`selectConversation()`
- 聊天界面显示：头像和标题

### 2. 客户会话持久化系统

#### CustomerSessionManager 类
```javascript
class CustomerSessionManager {
    static generatePersistentCustomerId() {
        // 检查是否已有持久化ID
        let customerId = localStorage.getItem('qt_customer_id');
        if (customerId) {
            return customerId;
        }
        
        // 生成新的持久化ID（基于时间戳和随机数）
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        customerId = `customer_${timestamp}_${random}`;
        
        // 保存到localStorage（持久化）和sessionStorage（会话级别备份）
        localStorage.setItem('qt_customer_id', customerId);
        sessionStorage.setItem('qt_customer_id', customerId);
        
        return customerId;
    }
    
    static getCurrentCustomerId() {
        // 优先从localStorage获取，其次从sessionStorage
        return localStorage.getItem('qt_customer_id') || 
               sessionStorage.getItem('qt_customer_id') || 
               this.generatePersistentCustomerId();
    }
    
    static resetCustomerSession() {
        // 清除会话信息（用于测试或强制重置）
        localStorage.removeItem('qt_customer_id');
        sessionStorage.removeItem('qt_customer_id');
        localStorage.removeItem('customer_number_map');
    }
}
```

### 3. 客户端SDK增强

#### 修改集成代码
需要在客户端集成代码（integration-code-final-fixed.html）中添加会话持久化逻辑：

```javascript
// 客户端会话管理
const CustomerSession = {
    getOrCreateCustomerId() {
        let customerId = localStorage.getItem('qt_customer_id');
        if (!customerId) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            customerId = `customer_${timestamp}_${random}`;
            localStorage.setItem('qt_customer_id', customerId);
        }
        return customerId;
    },
    
    // 在发送消息时包含持久化的客户ID
    sendMessage(content) {
        const customerId = this.getOrCreateCustomerId();
        // 发送消息逻辑...
    }
};
```

## 📁 修改的文件

### 管理后台
1. `backend/presentation/static/mobile-dashboard.html`
   - 添加 `generateCustomerNumber()` 函数
   - 更新对话列表渲染逻辑
   - 添加 `CustomerSessionManager` 类

2. `static/mobile-dashboard.html`（兼容副本）
   - 同步相同修改

### 客户端SDK（待实现）
1. `integration-code-final-fixed.html`
   - 添加客户ID持久化逻辑
   - 修改消息发送包含客户ID

## 🔄 工作流程

### 客户编号生成流程
1. 客户首次访问时，生成持久化ID
2. 管理后台收到消息时，检查客户是否已有编号
3. 如无编号，则根据现有客户数量生成新编号（客户001, 客户002...）
4. 编号映射保存在localStorage中，避免重复生成

### 会话持久化流程
1. 客户首次访问时，生成并保存持久化ID到localStorage
2. 后续访问（包括刷新）都使用相同的客户ID
3. 服务器端根据客户ID关联到同一个对话
4. 实现真正的会话连续性

## 🧪 测试方案

### 功能验证
1. **客户编号测试**
   - 创建多个客户会话，验证编号按序增长
   - 刷新管理后台，验证编号显示一致性

2. **会话持久化测试**
   - 客户发送消息后刷新页面
   - 验证是否继续在同一会话中
   - 验证消息历史是否保持

### 重置测试
```javascript
// 管理端重置客户编号映射
localStorage.removeItem('customer_number_map');

// 客户端重置会话
CustomerSessionManager.resetCustomerSession();
```

## 🚀 部署说明

### 模块化保持
- 所有修改都在现有文件中进行，保持子文件夹/子文件的模块化结构
- 没有引入新的依赖或构建步骤
- 遵循项目的"纯静态前端 + Rust后端"架构

### 向后兼容
- 现有的客户ID仍然有效
- 新的编号生成不影响已有对话
- 渐进式升级，无需数据迁移

## 📊 预期效果

1. **用户体验提升**
   - 客户看到统一的编号格式（客户001、客户002）
   - 刷新页面不会丢失对话上下文
   
2. **管理效率提升**  
   - 客服人员可以通过编号快速识别客户
   - 连续的对话历史便于问题跟踪

3. **系统稳定性**
   - 减少因刷新导致的重复会话
   - 更好的数据一致性