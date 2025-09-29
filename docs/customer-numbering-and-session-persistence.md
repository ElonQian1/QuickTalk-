# 客户编号系统与会话持久化改进

## 📋 问题描述

1. **客户名称显示问题**：原本显示为"客户 + customer_id"的格式，不够友好和规范
2. **会话持久化问题**：客户端刷新页面就变成新的消息入口，无法维持连续对话

## 🔧 解决方案

### 1. 客户编号系统 (Customer Numbering System)

#### 实现原理
- 使用localStorage存储客户ID与序号的映射关系 (`customer_number_map`)
- 按访问顺序分配编号：客户001、客户002、客户767等
- 编号格式：`客户${序号.padStart(3, '0')}`（如：客户001、客户767）

#### 核心功能
```javascript
// 生成客户编号的函数
generateCustomerNumber(customerId) {
    let customerNumberMap = JSON.parse(localStorage.getItem('customer_number_map') || '{}');
    
    if (customerNumberMap[customerId]) {
        return customerNumberMap[customerId];
    }
    
    let nextNumber = Object.keys(customerNumberMap).length + 1;
    let formattedNumber = `客户${String(nextNumber).padStart(3, '0')}`;
    
    customerNumberMap[customerId] = formattedNumber;
    localStorage.setItem('customer_number_map', JSON.stringify(customerNumberMap));
    
    return formattedNumber;
}
```

#### 应用位置
- **对话列表显示**：`renderConversationsList()` 中使用新的客户编号
- **聊天界面标题**：`selectConversation()` 中显示客户编号
- **头像生成**：使用编号的数字部分作为头像初始字母

### 2. 会话持久化系统 (Session Persistence)

#### 实现原理
- 使用localStorage存储持久化的客户ID (`qt_customer_id`)
- 客户端每次访问时检查是否已有ID，避免重复创建会话
- 提供会话重置功能用于测试和故障排除

#### 核心功能

**客户端SDK (integration-code-final-fixed.html)**
```javascript
// 客户会话持久化管理
getOrCreateUserId() {
    let persistentUserId = localStorage.getItem('qt_customer_id');
    
    if (persistentUserId) {
        return persistentUserId;
    }
    
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    persistentUserId = `customer_${timestamp}_${random}`;
    
    localStorage.setItem('qt_customer_id', persistentUserId);
    sessionStorage.setItem('qt_customer_id', persistentUserId);
    
    return persistentUserId;
}
```

**管理后台会话管理类**
```javascript
class CustomerSessionManager {
    static generatePersistentCustomerId() { /* ... */ }
    static getCurrentCustomerId() { /* ... */ }
    static resetCustomerSession() { /* ... */ }
}
```

### 3. 调试和管理工具

#### 客户端调试工具
```javascript
window.QuickTalkDebug = {
    getCurrentUserId: () => cs.userId,
    resetSession: () => cs.resetCustomerSession(),
    getStoredId: () => localStorage.getItem('qt_customer_id'),
    forceNewSession: () => { /* 强制创建新会话 */ },
    showSessionInfo: () => { /* 显示会话信息 */ }
};
```

#### 管理后台工具
- **查看客户信息**：显示客户ID、序号、对话ID等详细信息
- **会话管理工具**：清空客户编号缓存、查看映射关系
- **实时调试**：通过🔧按钮快速访问管理功能

## 📂 修改的文件

### 1. 前端界面文件
- `backend/presentation/static/mobile-dashboard.html` (统一来源)
- `static/mobile-dashboard.html` (兼容性副本)

### 2. 客户端SDK文件
- `integration-code-final-fixed.html` (集成代码模板)

### 3. 新增的核心函数

#### 管理后台新增函数
- `generateCustomerNumber(customerId)` - 生成客户编号
- `showCustomerSessionTools()` - 会话管理工具
- `CustomerSessionManager` 类 - 会话持久化管理

#### 客户端SDK新增函数
- `getOrCreateUserId()` - 获取或创建持久化用户ID
- `resetCustomerSession()` - 重置客户会话
- `QuickTalkDebug` 调试工具集

## 🎯 使用效果

### 1. 客户编号显示
- **之前**：客户customer_1757591780450_abc123
- **现在**：客户001、客户002、客户767

### 2. 会话持久化
- **之前**：每次刷新页面都创建新的对话入口
- **现在**：刷新页面保持同一客户身份，继续原有对话

### 3. 管理工具
- **客户信息查看**：显示编号、ID、对话状态
- **编号缓存管理**：清空重置、查看详情
- **调试支持**：控制台工具集、会话状态监控

## 🧪 测试方式

### 客户端测试
```javascript
// 在浏览器控制台中测试
QuickTalkDebug.showSessionInfo();  // 查看当前会话信息
QuickTalkDebug.resetSession();     // 重置会话
QuickTalkDebug.forceNewSession();  // 强制创建新会话
```

### 管理后台测试
1. 进入消息页面，选择任意对话
2. 点击🔧按钮打开会话管理工具
3. 查看客户编号分配情况
4. 测试编号缓存清空功能

## 🔮 后续优化方向

1. **服务器端支持**：将客户编号逻辑移到后端，支持跨设备同步
2. **编号持久化**：客户编号写入数据库，避免缓存丢失
3. **会话恢复**：支持跨浏览器的会话恢复功能
4. **统计分析**：客户访问统计、会话时长分析

## 🏗️ 架构保持

本次改进严格遵循项目架构约束：
- ✅ 纯静态前端 + Rust后端架构
- ✅ 子文件夹/子文件模块化组织
- ✅ 无Node.js依赖，无构建步骤
- ✅ 兼容现有API和WebSocket协议

---

**版本**：v1.0  
**更新时间**：2025年9月29日  
**作者**：GitHub Copilot