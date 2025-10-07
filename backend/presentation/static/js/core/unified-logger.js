/**
 * 统一日志管理器 - 消除日志记录重复代码
 * 
 * 设计目标:
 * 1. 统一所有模块的日志记录模式，避免重复的日志实现
 * 2. 提供标准化的日志格式和级别管理
 * 3. 支持命名空间和过滤功能
 * 4. 集成现有的QT_LOG系统
 * 
 * 这个管理器将替代各文件中的重复日志代码：
 * - websocket-manager.js 的 _log 方法
 * - base-manager.js 的 log 方法
 * - state-coordinator.js 的 log 方法
 * - api-client.js 的日志记录
 */

class UnifiedLogger {
    constructor(options = {}) {
        this.name = 'UnifiedLogger';
        this.options = {
            enableDebug: false,
            enableTimestamp: true,
            enableNamespace: true,
            enableIcons: true,
            maxLogHistory: 1000,
            persistLogs: false,
            ...options
        };

        // 日志级别配置
        this.levels = {
            debug: { priority: 0, icon: '🔍', color: '#6c757d', method: 'log' },
            info: { priority: 1, icon: 'ℹ️', color: '#0dcaf0', method: 'info' },
            warn: { priority: 2, icon: '⚠️', color: '#ffc107', method: 'warn' },
            error: { priority: 3, icon: '❌', color: '#dc3545', method: 'error' },
            success: { priority: 1, icon: '✅', color: '#198754', method: 'log' }
        };

        // 日志历史记录
        this.logHistory = [];
        
        // 命名空间过滤器
        this.namespaceFilters = new Set();
        
        // 日志监听器
        this.listeners = new Map();
        
        // 性能监控
        this.performanceMarks = new Map();
        
        this._initializeQTLogIntegration();
        this._initializePerformanceMonitoring();
    }

    /**
     * 创建模块特定的日志器
     */
    createModuleLogger(moduleName, options = {}) {
        const moduleOptions = {
            namespace: moduleName,
            enableDebug: this.options.enableDebug,
            ...options
        };

        return {
            debug: (message, ...args) => this.debug(moduleName, message, ...args),
            info: (message, ...args) => this.info(moduleName, message, ...args),
            warn: (message, ...args) => this.warn(moduleName, message, ...args),
            error: (message, ...args) => this.error(moduleName, message, ...args),
            success: (message, ...args) => this.success(moduleName, message, ...args),
            
            // 高级功能
            group: (name) => this.group(moduleName, name),
            groupEnd: () => this.groupEnd(moduleName),
            time: (label) => this.time(moduleName, label),
            timeEnd: (label) => this.timeEnd(moduleName, label),
            
            // 配置方法
            setDebugEnabled: (enabled) => {
                moduleOptions.enableDebug = enabled;
            },
            
            // 兼容旧系统
            log: (level, message, ...args) => this._legacyLog(moduleName, level, message, ...args)
        };
    }

    /**
     * Debug级别日志
     */
    debug(namespace, message, ...args) {
        this._log('debug', namespace, message, ...args);
    }

    /**
     * Info级别日志
     */
    info(namespace, message, ...args) {
        this._log('info', namespace, message, ...args);
    }

    /**
     * Warning级别日志
     */
    warn(namespace, message, ...args) {
        this._log('warn', namespace, message, ...args);
    }

    /**
     * Error级别日志
     */
    error(namespace, message, ...args) {
        this._log('error', namespace, message, ...args);
    }

    /**
     * Success级别日志
     */
    success(namespace, message, ...args) {
        this._log('success', namespace, message, ...args);
    }

    /**
     * 分组日志开始
     */
    group(namespace, groupName) {
        const label = this._formatLabel('info', namespace, `📁 ${groupName}`);
        console.group(label);
    }

    /**
     * 分组日志结束
     */
    groupEnd(namespace) {
        console.groupEnd();
    }

    /**
     * 性能计时开始
     */
    time(namespace, label) {
        const fullLabel = `${namespace}:${label}`;
        this.performanceMarks.set(fullLabel, performance.now());
        this._log('debug', namespace, `⏱️ 开始计时: ${label}`);
    }

    /**
     * 性能计时结束
     */
    timeEnd(namespace, label) {
        const fullLabel = `${namespace}:${label}`;
        const startTime = this.performanceMarks.get(fullLabel);
        
        if (startTime) {
            const duration = performance.now() - startTime;
            this.performanceMarks.delete(fullLabel);
            this._log('info', namespace, `⏱️ ${label}: ${duration.toFixed(2)}ms`);
            return duration;
        } else {
            this._log('warn', namespace, `⏱️ 计时器不存在: ${label}`);
            return null;
        }
    }

    /**
     * 设置命名空间过滤器
     */
    setNamespaceFilter(...namespaces) {
        this.namespaceFilters.clear();
        namespaces.forEach(ns => this.namespaceFilters.add(ns.toLowerCase()));
        this._log('info', 'Logger', `设置命名空间过滤器: ${namespaces.join(', ')}`);
    }

    /**
     * 清除命名空间过滤器
     */
    clearNamespaceFilter() {
        this.namespaceFilters.clear();
        this._log('info', 'Logger', '已清除命名空间过滤器');
    }

    /**
     * 添加日志监听器
     */
    addListener(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }

    /**
     * 移除日志监听器
     */
    removeListener(eventName, callback) {
        if (this.listeners.has(eventName)) {
            const listeners = this.listeners.get(eventName);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 获取日志历史
     */
    getHistory(filter = {}) {
        let history = [...this.logHistory];
        
        if (filter.namespace) {
            history = history.filter(log => log.namespace === filter.namespace);
        }
        
        if (filter.level) {
            history = history.filter(log => log.level === filter.level);
        }
        
        if (filter.since) {
            history = history.filter(log => log.timestamp >= filter.since);
        }
        
        return history;
    }

    /**
     * 清除日志历史
     */
    clearHistory() {
        this.logHistory = [];
        this._log('info', 'Logger', '日志历史已清除');
    }

    /**
     * 导出日志
     */
    exportLogs(format = 'json') {
        const data = this.getHistory();
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this._exportAsCSV(data);
            case 'text':
                return this._exportAsText(data);
            default:
                return data;
        }
    }

    // === 私有方法 ===

    /**
     * 核心日志方法
     */
    _log(level, namespace, message, ...args) {
        // 级别过滤
        if (level === 'debug' && !this.options.enableDebug) {
            return;
        }

        // 命名空间过滤
        if (this.namespaceFilters.size > 0 && 
            !this.namespaceFilters.has(namespace.toLowerCase())) {
            return;
        }

        const logEntry = {
            level,
            namespace,
            message,
            args,
            timestamp: new Date(),
            timestampMs: Date.now()
        };

        // 添加到历史记录
        this._addToHistory(logEntry);

        // 格式化并输出
        const formattedLabel = this._formatLabel(level, namespace, message);
        const levelConfig = this.levels[level] || this.levels.info;
        
        // 使用对应的console方法
        console[levelConfig.method](formattedLabel, ...args);

        // 触发监听器
        this._notifyListeners('log', logEntry);
        this._notifyListeners(`log:${level}`, logEntry);
    }

    /**
     * 兼容旧系统的日志方法
     */
    _legacyLog(namespace, level, message, ...args) {
        // 支持 BaseManager 风格: log(level, message, ...args)
        this._log(level, namespace, message, ...args);
    }

    /**
     * 格式化日志标签
     */
    _formatLabel(level, namespace, message) {
        const parts = [];
        
        // 图标
        if (this.options.enableIcons) {
            const levelConfig = this.levels[level] || this.levels.info;
            parts.push(levelConfig.icon);
        }
        
        // 命名空间
        if (this.options.enableNamespace) {
            parts.push(`[${namespace}]`);
        }
        
        // 时间戳
        if (this.options.enableTimestamp) {
            const timestamp = new Date().toLocaleTimeString();
            parts.push(`${timestamp}`);
        }
        
        // 消息
        parts.push(message);
        
        return parts.join(' ');
    }

    /**
     * 添加到历史记录
     */
    _addToHistory(logEntry) {
        this.logHistory.push(logEntry);
        
        // 限制历史记录大小
        if (this.logHistory.length > this.options.maxLogHistory) {
            this.logHistory = this.logHistory.slice(-this.options.maxLogHistory);
        }
        
        // 持久化存储(如果启用)
        if (this.options.persistLogs) {
            this._persistLog(logEntry);
        }
    }

    /**
     * 通知监听器
     */
    _notifyListeners(eventName, data) {
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[Logger] 监听器执行失败:', error);
                }
            });
        }
    }

    /**
     * 初始化QT_LOG系统集成
     */
    _initializeQTLogIntegration() {
        // 如果存在QT_LOG，则集成到它
        if (window.QT_LOG) {
            const originalQTLog = window.QT_LOG;
            
            // 扩展QT_LOG功能
            window.QT_LOG.unified = this;
            window.QT_LOG.createModuleLogger = (moduleName) => {
                return this.createModuleLogger(moduleName);
            };
            
            this._log('info', 'Logger', '已集成到QT_LOG系统');
        } else {
            // 创建基础的QT_LOG兼容接口
            window.QT_LOG = {
                debug: (ns, ...args) => this.debug(ns, ...args),
                info: (ns, ...args) => this.info(ns, ...args),
                warn: (ns, ...args) => this.warn(ns, ...args),
                error: (ns, ...args) => this.error(ns, ...args),
                unified: this,
                createModuleLogger: (moduleName) => this.createModuleLogger(moduleName)
            };
        }
    }

    /**
     * 初始化性能监控
     */
    _initializePerformanceMonitoring() {
        // 监控长时间运行的计时器
        setInterval(() => {
            const now = performance.now();
            for (const [label, startTime] of this.performanceMarks) {
                const duration = now - startTime;
                if (duration > 10000) { // 超过10秒
                    this._log('warn', 'Logger', `长时间运行的计时器: ${label} (${duration.toFixed(2)}ms)`);
                }
            }
        }, 30000); // 每30秒检查一次
    }

    /**
     * 持久化日志
     */
    _persistLog(logEntry) {
        try {
            const storageKey = 'unified_logger_history';
            const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existing.push(logEntry);
            
            // 限制存储大小
            if (existing.length > 500) {
                existing.splice(0, existing.length - 500);
            }
            
            localStorage.setItem(storageKey, JSON.stringify(existing));
        } catch (error) {
            // 存储失败时忽略，避免循环错误
        }
    }

    /**
     * 导出为CSV格式
     */
    _exportAsCSV(data) {
        const headers = ['Timestamp', 'Level', 'Namespace', 'Message', 'Args'];
        const rows = data.map(log => [
            log.timestamp.toISOString(),
            log.level,
            log.namespace,
            log.message,
            JSON.stringify(log.args)
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    /**
     * 导出为文本格式
     */
    _exportAsText(data) {
        return data.map(log => {
            const timestamp = log.timestamp.toLocaleString();
            const levelConfig = this.levels[log.level] || this.levels.info;
            const argsStr = log.args.length > 0 ? ` ${JSON.stringify(log.args)}` : '';
            return `${timestamp} ${levelConfig.icon} [${log.namespace}] ${log.message}${argsStr}`;
        }).join('\n');
    }

    /**
     * 销毁日志器
     */
    destroy() {
        this.clearHistory();
        this.listeners.clear();
        this.performanceMarks.clear();
        this.namespaceFilters.clear();
    }
}

// 创建全局单例
window.UnifiedLogger = new UnifiedLogger({
    enableDebug: false, // 生产环境可设为false
    enableTimestamp: true,
    enableNamespace: true,
    enableIcons: true
});

// 为常用模块创建专用日志器
window.Loggers = {
    WebSocket: window.UnifiedLogger.createModuleLogger('WebSocket'),
    BaseManager: window.UnifiedLogger.createModuleLogger('BaseManager'),
    StateCoordinator: window.UnifiedLogger.createModuleLogger('StateCoordinator'),
    TemplateRenderer: window.UnifiedLogger.createModuleLogger('TemplateRenderer'),
    APIClient: window.UnifiedLogger.createModuleLogger('APIClient')
};

// 兼容浏览器环境：使用window对象而不是ES6 export
console.log('✅ 统一日志系统已加载 (UnifiedLogger)');