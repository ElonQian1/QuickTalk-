/**
 * 统一日志系统
 * 提供结构化的日志记录和调试功能
 * 
 * @author GitHub Copilot  
 * @version 1.0
 * @date 2025-10-03
 */

class Logger {
    constructor(options = {}) {
        this.level = options.level || 'INFO';
        this.enableConsole = options.enableConsole !== false;
        this.enableStorage = options.enableStorage || false;
        this.maxStorageEntries = options.maxStorageEntries || 1000;
        this.context = options.context || 'App';
        
        this.levels = {
            DEBUG: 0,
            INFO: 1, 
            WARN: 2,
            ERROR: 3
        };

        this.logs = [];
        this.startTime = Date.now();
    }

    /**
     * 设置日志级别
     */
    setLevel(level) {
        this.level = level.toUpperCase();
        this.info('Logger', `日志级别设置为: ${this.level}`);
    }

    /**
     * 设置上下文
     */
    setContext(context) {
        this.context = context;
    }

    /**
     * DEBUG 级别日志
     */
    debug(module, message, data = null) {
        this._log('DEBUG', module, message, data);
    }

    /**
     * INFO 级别日志
     */
    info(module, message, data = null) {
        this._log('INFO', module, message, data);
    }

    /**
     * WARN 级别日志
     */
    warn(module, message, data = null) {
        this._log('WARN', module, message, data);
    }

    /**
     * ERROR 级别日志
     */
    error(module, message, data = null) {
        this._log('ERROR', module, message, data);
    }

    /**
     * 记录性能指标
     */
    performance(module, operation, duration) {
        this.info(module, `⚡ ${operation} 耗时: ${duration}ms`);
    }

    /**
     * 记录用户操作
     */
    userAction(action, details = null) {
        this.info('UserAction', `👆 ${action}`, details);
    }

    /**
     * 记录网络请求
     */
    network(method, url, status, duration = null) {
        const message = `🌐 ${method} ${url} - ${status}`;
        const data = duration ? { duration } : null;
        
        if (status >= 400) {
            this.error('Network', message, data);
        } else {
            this.info('Network', message, data);
        }
    }

    /**
     * 获取日志
     */
    getLogs(level = null, module = null) {
        let filteredLogs = this.logs;

        if (level) {
            const levelValue = this.levels[level.toUpperCase()];
            filteredLogs = filteredLogs.filter(log => 
                this.levels[log.level] >= levelValue
            );
        }

        if (module) {
            filteredLogs = filteredLogs.filter(log => 
                log.module.includes(module)
            );
        }

        return filteredLogs;
    }

    /**
     * 清理日志
     */
    clear() {
        this.logs = [];
        if (this.enableConsole) {
            console.clear();
        }
        this.info('Logger', '日志已清理');
    }

    /**
     * 导出日志
     */
    export() {
        const exportData = {
            context: this.context,
            startTime: new Date(this.startTime).toISOString(),
            exportTime: new Date().toISOString(),
            logs: this.logs
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 内部日志记录方法
     * @private
     */
    _log(level, module, message, data) {
        const levelValue = this.levels[level];
        const currentLevelValue = this.levels[this.level];

        if (levelValue < currentLevelValue) {
            return; // 跳过低级别日志
        }

        const timestamp = Date.now();
        const logEntry = {
            timestamp,
            level,
            module,
            message,
            data,
            context: this.context
        };

        // 存储日志
        if (this.enableStorage) {
            this.logs.push(logEntry);
            
            // 限制存储大小
            if (this.logs.length > this.maxStorageEntries) {
                this.logs.splice(0, this.logs.length - this.maxStorageEntries);
            }
        }

        // 控制台输出
        if (this.enableConsole) {
            this._outputToConsole(logEntry);
        }
    }

    /**
     * 输出到控制台
     * @private
     */
    _outputToConsole(logEntry) {
        const { level, module, message, data } = logEntry;
        const timeStr = new Date(logEntry.timestamp).toLocaleTimeString();
        const prefix = `[${timeStr}] ${this.context}:${module}`;

        const formatMessage = `${prefix} ${message}`;

        switch (level) {
            case 'DEBUG':
                console.debug(formatMessage, data || '');
                break;
            case 'INFO':
                console.info(formatMessage, data || '');
                break;
            case 'WARN':
                console.warn(formatMessage, data || '');
                break;
            case 'ERROR':
                console.error(formatMessage, data || '');
                break;
        }
    }
}

// 注册到模块系统
window.registerModule('Logger', Logger);

// 创建全局实例
window.logger = new Logger({ context: 'QuickTalk' });

// 便捷方法
window.log = {
    debug: (module, message, data) => window.logger.debug(module, message, data),
    info: (module, message, data) => window.logger.info(module, message, data),
    warn: (module, message, data) => window.logger.warn(module, message, data),
    error: (module, message, data) => window.logger.error(module, message, data),
    performance: (module, operation, duration) => window.logger.performance(module, operation, duration),
    userAction: (action, details) => window.logger.userAction(action, details),
    network: (method, url, status, duration) => window.logger.network(method, url, status, duration)
};

console.log('📝 统一日志系统已初始化');