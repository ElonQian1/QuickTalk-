/**
 * 事件总线加载顺序配置 - Event Bus Loading Order
 * 
 * 📋 推荐加载顺序（按顺序加载）：
 * 
 * 1️⃣ 核心依赖
 * <script src="/static/js/core/qt-config.js"></script>
 * <script src="/static/js/core/state-texts.js"></script>
 * <script src="/static/js/core/unified-logger.js"></script>
 * 
 * 2️⃣ 统一事件总线（必须）
 * <script src="/static/js/core/unified-event-bus.js"></script>
 * 
 * 3️⃣ 迁移适配器（可选，如果有旧代码）
 * <script src="/static/js/core/event-bus-migration.js"></script>
 * 
 * ⚠️ 不再需要加载：
 * ❌ <script src="/static/js/core/event-bus.js"></script>              <!-- 已废弃 -->
 * ❌ <script src="/static/js/message/core/message-event-bus.js"></script> <!-- 已废弃 -->
 * 
 * ---
 * 
 * 📖 使用指南：
 * 
 * **新代码（推荐）：**
 * ```javascript
 * // 使用全局单例
 * window.eventBus.on('my-event', (data) => {
 *     console.log('收到事件:', data);
 * });
 * 
 * window.eventBus.emit('my-event', { foo: 'bar' });
 * ```
 * 
 * **兼容旧代码（自动适配）：**
 * ```javascript
 * // MessageEventBus API（自动重定向到 UnifiedEventBus）
 * MessageEventBus.subscribe('message.new', handler);
 * MessageEventBus.publish('message.new', payload);
 * 
 * // EventBus API（自动重定向到 UnifiedEventBus）
 * const bus = new EventBus(); // 会显示警告
 * bus.on('event', handler);
 * bus.emit('event', data);
 * ```
 * 
 * ---
 * 
 * 🔧 迁移检查工具：
 * 
 * 在浏览器控制台运行：
 * ```javascript
 * checkEventBusMigration();
 * ```
 * 
 * 查看详细统计：
 * ```javascript
 * window.eventBus.debug();
 * ```
 * 
 * ---
 * 
 * 📊 性能对比：
 * 
 * | 指标 | 旧版 EventBus | 旧版 MessageEventBus | UnifiedEventBus |
 * |------|---------------|---------------------|-----------------|
 * | 文件大小 | 156 行 | 40 行 | 342 行 |
 * | 内存占用 | 2x 实例 | 2x 实例 | 1x 实例 |
 * | 功能重复 | 是 | 是 | 否 |
 * | 调试支持 | 基础 | 无 | 完整 |
 * | 统计信息 | 无 | 无 | 有 |
 * | DOM 桥接 | 无 | 有 | 有 |
 * 
 * 统一后节省：
 * - 减少 1 个全局对象
 * - 减少 ~50% 重复代码
 * - 提供统一调试接口
 * 
 * ---
 * 
 * @version 1.0.0
 * @date 2025-10-06
 */

// 此文件仅用于文档说明，不包含可执行代码
console.log('📚 事件总线加载配置文档已加载');
