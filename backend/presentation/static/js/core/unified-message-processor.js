/**
 * 统一WebSocket消息处理器 - 消除重复的消息处理逻辑
 * 包含：消息序列化/反序列化、分发、类型处理、状态管理等统一功能
 */
(function() {
    'use strict';

    /**
     * 统一WebSocket消息处理器类
     * 消除重复的JSON解析、消息分发、事件处理逻辑
     */
    class UnifiedMessageProcessor {
        constructor(options = {}) {
            this.options = {
                enableLogging: options.enableLogging !== false,
                logNamespace: options.logNamespace || 'MessageProcessor',
                enableMetrics: options.enableMetrics !== false,
                enableValidation: options.enableValidation !== false,
                maxRetries: options.maxRetries || 3,
                retryDelay: options.retryDelay || 1000,
                enableQueue: options.enableQueue !== false,
                maxQueueSize: options.maxQueueSize || 100,
                enableBroadcast: options.enableBroadcast !== false,
                enableHistory: options.enableHistory !== false,
                maxHistorySize: options.maxHistorySize || 50,
                ...options
            };

            // 消息处理器映射
            this.handlers = new Map();
            this.middlewares = [];
            this.validators = new Map();
            
            // 消息队列和历史
            this.messageQueue = [];
            this.messageHistory = [];
            this.pendingMessages = new Map();
            
            // 统计信息
            this.metrics = {
                processed: 0,
                errors: 0,
                queued: 0,
                sent: 0,
                received: 0,
                parsed: 0,
                validated: 0,
                startTime: Date.now()
            };

            // 事件监听器
            this.eventListeners = new Map();
            
            // 初始化日志器
            this.logger = this._initLogger();
            
            this._log('info', '统一消息处理器初始化完成');
        }

        /**
         * 统一消息解析方法 - 消除重复的JSON.parse逻辑
         */
        parseMessage(rawData, options = {}) {
            const startTime = performance.now();
            
            try {
                let parsed;
                
                // 处理不同类型的输入
                if (typeof rawData === 'string') {
                    try {
                        parsed = JSON.parse(rawData);
                        this.metrics.parsed++;
                    } catch (e) {
                        // 尝试处理非JSON字符串
                        if (options.allowPlainText !== false) {
                            parsed = { type: 'text', content: rawData, timestamp: Date.now() };
                        } else {
                            throw new Error(`JSON解析失败: ${e.message}`);
                        }
                    }
                } else if (typeof rawData === 'object' && rawData !== null) {
                    // 深拷贝对象避免引用问题
                    parsed = JSON.parse(JSON.stringify(rawData));
                } else {
                    parsed = { type: 'unknown', data: rawData, timestamp: Date.now() };
                }

                // 标准化消息格式
                const standardized = this._standardizeMessage(parsed);
                
                // 验证消息
                if (this.options.enableValidation) {
                    this._validateMessage(standardized);
                    this.metrics.validated++;
                }

                // 记录处理时间
                standardized._processingTime = performance.now() - startTime;
                
                this._log('debug', '消息解析成功:', standardized);
                return standardized;
                
            } catch (error) {
                this.metrics.errors++;
                this._log('error', '消息解析失败:', error, '原始数据:', rawData);
                
                // 返回错误消息对象而不是抛出异常
                return {
                    type: 'error',
                    error: error.message,
                    originalData: rawData,
                    timestamp: Date.now(),
                    _processingTime: performance.now() - startTime
                };
            }
        }

        /**
         * 统一消息序列化方法 - 消除重复的JSON.stringify逻辑
         */
        serializeMessage(message, options = {}) {
            try {
                let serialized;
                
                if (typeof message === 'string') {
                    serialized = message;
                } else if (typeof message === 'object' && message !== null) {
                    // 添加默认字段
                    const enriched = {
                        timestamp: Date.now(),
                        ...message
                    };
                    
                    // 处理循环引用
                    if (options.safeStringify) {
                        serialized = this._safeStringify(enriched);
                    } else {
                        serialized = JSON.stringify(enriched);
                    }
                } else {
                    serialized = String(message);
                }

                this.metrics.sent++;
                this._log('debug', '消息序列化成功:', { length: serialized.length });
                return serialized;
                
            } catch (error) {
                this.metrics.errors++;
                this._log('error', '消息序列化失败:', error, '原始消息:', message);
                
                // 返回错误字符串而不是抛出异常
                return JSON.stringify({
                    type: 'error',
                    error: '序列化失败: ' + error.message,
                    timestamp: Date.now()
                });
            }
        }

        /**
         * 统一消息分发方法 - 消除重复的事件分发逻辑
         */
        processMessage(message, context = {}) {
            const startTime = performance.now();
            
            try {
                // 解析消息
                const parsed = this.parseMessage(message);
                this.metrics.processed++;
                this.metrics.received++;

                // 添加到历史记录
                if (this.options.enableHistory) {
                    this._addToHistory(parsed);
                }

                // 执行中间件
                const processedMessage = this._runMiddlewares(parsed, context);
                
                // 分发给类型处理器
                this._dispatchByType(processedMessage, context);
                
                // 分发给通用监听器
                this._dispatchToListeners('message', processedMessage, context);
                
                // 记录处理时间
                const processingTime = performance.now() - startTime;
                this._log('debug', `消息处理完成 (${processingTime.toFixed(2)}ms):`, processedMessage.type);
                
                return processedMessage;
                
            } catch (error) {
                this.metrics.errors++;
                this._log('error', '消息处理失败:', error);
                
                // 分发错误事件
                this._dispatchToListeners('error', {
                    error: error.message,
                    originalMessage: message,
                    context,
                    timestamp: Date.now()
                });
                
                throw error;
            }
        }

        /**
         * 注册消息类型处理器
         */
        registerHandler(messageType, handler, options = {}) {
            if (typeof handler !== 'function') {
                throw new Error('处理器必须是函数');
            }

            const handlerInfo = {
                fn: handler,
                priority: options.priority || 0,
                once: options.once || false,
                validate: options.validate || null,
                id: this._generateId()
            };

            if (!this.handlers.has(messageType)) {
                this.handlers.set(messageType, []);
            }

            const handlers = this.handlers.get(messageType);
            handlers.push(handlerInfo);
            
            // 按优先级排序
            handlers.sort((a, b) => b.priority - a.priority);

            this._log('info', `注册消息处理器: ${messageType}`, { priority: handlerInfo.priority, id: handlerInfo.id });
            
            return handlerInfo.id;
        }

        /**
         * 移除消息处理器
         */
        unregisterHandler(messageType, handlerId) {
            if (!this.handlers.has(messageType)) return false;

            const handlers = this.handlers.get(messageType);
            const index = handlers.findIndex(h => h.id === handlerId);
            
            if (index !== -1) {
                handlers.splice(index, 1);
                this._log('info', `移除消息处理器: ${messageType}#${handlerId}`);
                return true;
            }
            
            return false;
        }

        /**
         * 注册中间件
         */
        use(middleware, options = {}) {
            if (typeof middleware !== 'function') {
                throw new Error('中间件必须是函数');
            }

            const middlewareInfo = {
                fn: middleware,
                priority: options.priority || 0,
                name: options.name || `middleware-${this.middlewares.length}`,
                id: this._generateId()
            };

            this.middlewares.push(middlewareInfo);
            this.middlewares.sort((a, b) => b.priority - a.priority);

            this._log('info', `注册中间件: ${middlewareInfo.name}`, { priority: middlewareInfo.priority });
            
            return middlewareInfo.id;
        }

        /**
         * 注册消息验证器
         */
        registerValidator(messageType, validator) {
            if (typeof validator !== 'function') {
                throw new Error('验证器必须是函数');
            }

            this.validators.set(messageType, validator);
            this._log('info', `注册消息验证器: ${messageType}`);
        }

        /**
         * 添加事件监听器
         */
        on(eventName, listener, options = {}) {
            if (!this.eventListeners.has(eventName)) {
                this.eventListeners.set(eventName, []);
            }

            const listenerInfo = {
                fn: listener,
                once: options.once || false,
                priority: options.priority || 0,
                id: this._generateId()
            };

            const listeners = this.eventListeners.get(eventName);
            listeners.push(listenerInfo);
            listeners.sort((a, b) => b.priority - a.priority);

            return listenerInfo.id;
        }

        /**
         * 移除事件监听器
         */
        off(eventName, listenerId) {
            if (!this.eventListeners.has(eventName)) return false;

            const listeners = this.eventListeners.get(eventName);
            const index = listeners.findIndex(l => l.id === listenerId);
            
            if (index !== -1) {
                listeners.splice(index, 1);
                return true;
            }
            
            return false;
        }

        /**
         * 获取处理统计信息
         */
        getMetrics() {
            const runtime = Date.now() - this.metrics.startTime;
            
            return {
                ...this.metrics,
                runtime,
                avgProcessingTime: this.metrics.processed > 0 ? runtime / this.metrics.processed : 0,
                errorRate: this.metrics.processed > 0 ? (this.metrics.errors / this.metrics.processed * 100).toFixed(2) + '%' : '0%',
                queueSize: this.messageQueue.length,
                historySize: this.messageHistory.length,
                handlersCount: Array.from(this.handlers.values()).reduce((sum, arr) => sum + arr.length, 0),
                middlewaresCount: this.middlewares.length
            };
        }

        /**
         * 清理资源
         */
        dispose() {
            this.handlers.clear();
            this.middlewares = [];
            this.validators.clear();
            this.eventListeners.clear();
            this.messageQueue = [];
            this.messageHistory = [];
            this.pendingMessages.clear();
            
            this._log('info', '消息处理器已清理');
        }

        // === 私有方法 ===

        /**
         * 标准化消息格式
         */
        _standardizeMessage(message) {
            const standard = {
                type: 'unknown',
                timestamp: Date.now(),
                id: this._generateId(),
                ...message
            };

            // 确保必要字段存在
            if (!standard.type && standard.action) {
                standard.type = standard.action;
            }

            return standard;
        }

        /**
         * 验证消息
         */
        _validateMessage(message) {
            // 通用验证
            if (!message.type) {
                throw new Error('消息缺少type字段');
            }

            // 类型特定验证
            if (this.validators.has(message.type)) {
                const validator = this.validators.get(message.type);
                const result = validator(message);
                
                if (result !== true) {
                    throw new Error(`消息验证失败: ${result}`);
                }
            }
        }

        /**
         * 执行中间件
         */
        _runMiddlewares(message, context) {
            let processedMessage = message;
            
            for (const middleware of this.middlewares) {
                try {
                    const result = middleware.fn(processedMessage, context);
                    if (result !== undefined) {
                        processedMessage = result;
                    }
                } catch (error) {
                    this._log('error', `中间件执行失败: ${middleware.name}`, error);
                    // 继续执行其他中间件
                }
            }
            
            return processedMessage;
        }

        /**
         * 按类型分发消息
         */
        _dispatchByType(message, context) {
            if (!this.handlers.has(message.type)) {
                this._log('debug', `无处理器: ${message.type}`);
                return;
            }

            const handlers = this.handlers.get(message.type);
            const toRemove = [];

            for (const handler of handlers) {
                try {
                    // 执行验证器
                    if (handler.validate && !handler.validate(message)) {
                        this._log('debug', `处理器验证失败: ${message.type}`);
                        continue;
                    }

                    // 执行处理器
                    handler.fn(message, context);

                    // 标记一次性处理器为移除
                    if (handler.once) {
                        toRemove.push(handler.id);
                    }
                } catch (error) {
                    this._log('error', `处理器执行失败: ${message.type}`, error);
                }
            }

            // 移除一次性处理器
            toRemove.forEach(id => this.unregisterHandler(message.type, id));
        }

        /**
         * 分发给事件监听器
         */
        _dispatchToListeners(eventName, data, context = {}) {
            if (!this.eventListeners.has(eventName)) return;

            const listeners = this.eventListeners.get(eventName);
            const toRemove = [];

            for (const listener of listeners) {
                try {
                    listener.fn(data, context);
                    
                    if (listener.once) {
                        toRemove.push(listener.id);
                    }
                } catch (error) {
                    this._log('error', `事件监听器执行失败: ${eventName}`, error);
                }
            }

            // 移除一次性监听器
            toRemove.forEach(id => this.off(eventName, id));
        }

        /**
         * 添加到历史记录
         */
        _addToHistory(message) {
            this.messageHistory.push({
                ...message,
                _receivedAt: Date.now()
            });

            // 限制历史记录大小
            if (this.messageHistory.length > this.options.maxHistorySize) {
                this.messageHistory.shift();
            }
        }

        /**
         * 安全的JSON字符串化（处理循环引用）
         */
        _safeStringify(obj) {
            const seen = new WeakSet();
            
            return JSON.stringify(obj, function(key, val) {
                if (val != null && typeof val === 'object') {
                    if (seen.has(val)) {
                        return '[Circular]';
                    }
                    seen.add(val);
                }
                return val;
            });
        }

        /**
         * 初始化日志器
         */
        _initLogger() {
            if (window.getLogger && this.options.enableLogging) {
                return window.getLogger(this.options.logNamespace);
            } else {
                return {
                    debug: () => {},
                    info: () => {},
                    warn: () => {},
                    error: () => {}
                };
            }
        }

        /**
         * 记录日志
         */
        _log(level, ...args) {
            if (this.logger && this.logger[level]) {
                this.logger[level](...args);
            }
        }

        /**
         * 生成唯一ID
         */
        _generateId() {
            return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    // === 全局实例和兼容性 ===

    // 创建全局实例
    const globalProcessor = new UnifiedMessageProcessor({
        logNamespace: 'GlobalMessageProcessor',
        enableLogging: true,
        enableMetrics: true
    });

    // 注册常见消息类型的默认处理器
    globalProcessor.registerHandler('ping', (message) => {
        globalProcessor._log('debug', '收到ping消息');
    });

    globalProcessor.registerHandler('pong', (message) => {
        globalProcessor._log('debug', '收到pong消息');
    });

    globalProcessor.registerHandler('auth', (message) => {
        globalProcessor._log('info', '收到认证消息:', message);
    });

    globalProcessor.registerHandler('error', (message) => {
        globalProcessor._log('error', '收到错误消息:', message);
    });

    // 导出到全局
    window.UnifiedMessageProcessor = UnifiedMessageProcessor;
    window.messageProcessor = globalProcessor;

    // 兼容性别名
    window.MessageProcessor = UnifiedMessageProcessor;
    window.globalMessageProcessor = globalProcessor;

    // 便捷方法
    window.processMessage = (message, context) => globalProcessor.processMessage(message, context);
    window.parseMessage = (rawData, options) => globalProcessor.parseMessage(rawData, options);
    window.serializeMessage = (message, options) => globalProcessor.serializeMessage(message, options);
    window.registerMessageHandler = (type, handler, options) => globalProcessor.registerHandler(type, handler, options);

    // 模块注册
    if (window.ModuleRegistry) {
        try {
            window.ModuleRegistry.register('UnifiedMessageProcessor', () => UnifiedMessageProcessor, []);
        } catch (e) {
            console.warn('模块注册失败:', e);
        }
    }

    console.log('✅ 统一WebSocket消息处理器已加载 (unified-message-processor.js)');

})();