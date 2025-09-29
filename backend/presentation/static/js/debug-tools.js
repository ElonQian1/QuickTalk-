/**
 * 调试工具模块
 * 提供管理后台的调试和会话管理工具
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class DebugTools {
    constructor() {
        this.init();
    }

    /**
     * 初始化调试工具
     */
    init() {
        // 创建全局调试对象
        this.createGlobalDebugObject();
        
        // 设置调试样式
        this.setupDebugStyles();
        
        console.log('调试工具模块已加载');
    }

    /**
     * 创建全局调试对象
     */
    createGlobalDebugObject() {
        window.QuickTalkDebug = {
            // 会话管理
            getCurrentUserId: () => window.SessionManager?.getCurrentCustomerId(),
            resetSession: () => window.SessionManager?.resetCustomerSession(),
            getStoredId: () => localStorage.getItem('qt_customer_id'),
            forceNewSession: () => window.SessionManager?.forceNewSession(),
            showSessionInfo: () => window.SessionManager?.getSessionInfo(),
            
            // 客户编号管理
            getCustomerNumber: (id) => window.CustomerNumbering?.getCustomerNumber(id),
            getAllCustomers: () => window.CustomerNumbering?.getAllCustomerNumbers(),
            clearCustomerNumbers: () => window.CustomerNumbering?.clearAllCustomerNumbers(),
            getCustomerCount: () => window.CustomerNumbering?.getCustomerCount(),
            getTotalVisitors: () => window.CustomerNumbering?.getTotalVisitorCount(),
            getNextNumber: () => {
                const total = window.CustomerNumbering?.getTotalVisitorCount() || 0;
                return `客户${String(total + 1).padStart(3, '0')}`;
            },
            
            // 存储管理
            clearAllStorage: () => this.clearAllStorage(),
            exportData: () => this.exportDebugData(),
            importData: (data) => this.importDebugData(data),
            
            // 调试信息
            getSystemInfo: () => this.getSystemInfo(),
            runDiagnostics: () => this.runDiagnostics(),
            
            // 工具函数
            showTools: () => this.showCustomerSessionTools()
        };
    }

    /**
     * 设置调试工具的CSS样式
     */
    setupDebugStyles() {
        if (document.getElementById('debug-tools-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'debug-tools-styles';
        style.textContent = `
            .debug-panel {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 15px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 12px;
                z-index: 10000;
                max-width: 300px;
                max-height: 400px;
                overflow-y: auto;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .debug-panel h3 {
                margin: 0 0 10px 0;
                color: #4CAF50;
                border-bottom: 1px solid #333;
                padding-bottom: 5px;
            }
            
            .debug-panel .debug-item {
                margin: 8px 0;
                padding: 5px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .debug-panel .debug-label {
                color: #FFC107;
                font-weight: bold;
            }
            
            .debug-panel .debug-value {
                color: #E0E0E0;
                word-break: break-all;
            }
            
            .debug-panel button {
                background: #2196F3;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                margin: 2px;
                font-size: 11px;
            }
            
            .debug-panel button:hover {
                background: #1976D2;
            }
            
            .debug-panel button.danger {
                background: #F44336;
            }
            
            .debug-panel button.danger:hover {
                background: #D32F2F;
            }
            
            .debug-close {
                position: absolute;
                top: 5px;
                right: 10px;
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 16px;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 显示客户会话管理工具
     */
    showCustomerSessionTools() {
        // 移除现有面板
        const existingPanel = document.getElementById('debug-session-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const sessionInfo = window.SessionManager?.getSessionInfo() || {};
        const customerStats = window.CustomerNumbering?.getAllCustomerNumbers() || {};
        const totalVisitors = window.CustomerNumbering?.getTotalVisitorCount() || 0;
        const activeCustomers = Object.keys(customerStats).length;
        
        const panel = document.createElement('div');
        panel.id = 'debug-session-panel';
        panel.className = 'debug-panel';
        
        panel.innerHTML = `
            <button class="debug-close" onclick="this.parentElement.remove()">×</button>
            <h3>🔧 会话管理工具</h3>
            
            <div class="debug-item">
                <div class="debug-label">当前客户ID:</div>
                <div class="debug-value">${sessionInfo.customerId || '无'}</div>
            </div>
            
            <div class="debug-item">
                <div class="debug-label">客户编号:</div>
                <div class="debug-value">${sessionInfo.customerId ? window.CustomerNumbering?.getCustomerNumber(sessionInfo.customerId) || '未分配' : '无'}</div>
            </div>
            
            <div class="debug-item">
                <div class="debug-label">会话状态:</div>
                <div class="debug-value">${sessionInfo.hasPersistedSession ? '已持久化' : '临时会话'}</div>
            </div>
            
            <div class="debug-item">
                <div class="debug-label">总访问者:</div>
                <div class="debug-value">${totalVisitors} 位（下个编号: 客户${String(totalVisitors + 1).padStart(3, '0')}）</div>
            </div>
            
            <div class="debug-item">
                <div class="debug-label">活跃客户:</div>
                <div class="debug-value">${activeCustomers} 个</div>
            </div>
            
            <div class="debug-item">
                <button onclick="window.QuickTalkDebug.showSessionInfo(); console.log('会话信息已输出到控制台')">查看详细信息</button>
                <button onclick="window.QuickTalkDebug.resetSession(); location.reload()">重置会话</button>
            </div>
            
            <div class="debug-item">
                <button onclick="console.log('客户编号:', window.QuickTalkDebug.getAllCustomers())">客户编号列表</button>
                <button class="danger" onclick="if(confirm('确定清空所有客户编号？')) { window.QuickTalkDebug.clearCustomerNumbers(); location.reload(); }">清空编号</button>
            </div>
            
            <div class="debug-item">
                <button onclick="window.QuickTalkDebug.runDiagnostics()">运行诊断</button>
                <button onclick="console.log('系统信息:', window.QuickTalkDebug.getSystemInfo())">系统信息</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        console.log('客户会话管理工具已显示');
        return sessionInfo;
    }

    /**
     * 清空所有存储数据
     */
    clearAllStorage() {
        if (!confirm('确定要清空所有存储数据吗？这将重置所有客户会话和编号。')) {
            return;
        }
        
        // 清空localStorage中的相关数据
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('qt_') || key.includes('customer'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // 清空sessionStorage
        sessionStorage.clear();
        
        console.log('所有存储数据已清空');
        alert('存储数据已清空，页面将刷新');
        location.reload();
    }

    /**
     * 导出调试数据
     * @returns {Object} 调试数据对象
     */
    exportDebugData() {
        const debugData = {
            timestamp: new Date().toISOString(),
            sessionInfo: window.SessionManager?.getSessionInfo(),
            customerNumbers: window.CustomerNumbering?.getAllCustomerNumbers(),
            localStorage: {},
            sessionStorage: {}
        };
        
        // 导出相关的localStorage数据
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('qt_') || key.includes('customer'))) {
                debugData.localStorage[key] = localStorage.getItem(key);
            }
        }
        
        // 导出sessionStorage数据
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('qt_') || key.includes('customer'))) {
                debugData.sessionStorage[key] = sessionStorage.getItem(key);
            }
        }
        
        console.log('调试数据导出:', debugData);
        return debugData;
    }

    /**
     * 导入调试数据
     * @param {Object} data 要导入的数据
     */
    importDebugData(data) {
        if (!data || typeof data !== 'object') {
            console.error('无效的导入数据');
            return;
        }
        
        try {
            // 导入localStorage数据
            if (data.localStorage) {
                Object.entries(data.localStorage).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
            }
            
            // 导入sessionStorage数据
            if (data.sessionStorage) {
                Object.entries(data.sessionStorage).forEach(([key, value]) => {
                    sessionStorage.setItem(key, value);
                });
            }
            
            console.log('调试数据导入成功');
            location.reload();
        } catch (error) {
            console.error('导入调试数据失败:', error);
        }
    }

    /**
     * 获取系统信息
     * @returns {Object} 系统信息对象
     */
    getSystemInfo() {
        return {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            storage: {
                localStorage: {
                    available: typeof Storage !== 'undefined',
                    used: JSON.stringify(localStorage).length
                },
                sessionStorage: {
                    available: typeof Storage !== 'undefined',
                    used: JSON.stringify(sessionStorage).length
                }
            },
            modules: {
                SessionManager: !!window.SessionManager,
                CustomerNumbering: !!window.CustomerNumbering,
                QuickTalkDebug: !!window.QuickTalkDebug
            }
        };
    }

    /**
     * 运行系统诊断
     * @returns {Object} 诊断结果
     */
    runDiagnostics() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            status: 'success',
            issues: [],
            warnings: [],
            info: []
        };

        // 检查模块加载状态
        if (!window.SessionManager) {
            diagnostics.issues.push('SessionManager模块未加载');
            diagnostics.status = 'error';
        }
        
        if (!window.CustomerNumbering) {
            diagnostics.issues.push('CustomerNumbering模块未加载');
            diagnostics.status = 'error';
        }

        // 检查存储功能
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
        } catch (e) {
            diagnostics.issues.push('localStorage不可用');
            diagnostics.status = 'error';
        }

        try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
        } catch (e) {
            diagnostics.issues.push('sessionStorage不可用');
            diagnostics.status = 'error';
        }

        // 检查会话状态
        const sessionInfo = window.SessionManager?.getSessionInfo();
        if (sessionInfo) {
            if (!sessionInfo.customerId) {
                diagnostics.warnings.push('没有活跃的客户会话');
            } else {
                diagnostics.info.push(`客户会话活跃: ${sessionInfo.customerId}`);
            }
        }

        // 检查客户编号系统
        const customerCount = window.CustomerNumbering?.getCustomerCount();
        if (customerCount !== undefined) {
            diagnostics.info.push(`已分配客户编号: ${customerCount}个`);
        }

        console.group('🔍 系统诊断结果');
        console.log('状态:', diagnostics.status);
        if (diagnostics.issues.length > 0) {
            console.error('问题:', diagnostics.issues);
        }
        if (diagnostics.warnings.length > 0) {
            console.warn('警告:', diagnostics.warnings);
        }
        if (diagnostics.info.length > 0) {
            console.info('信息:', diagnostics.info);
        }
        console.groupEnd();

        return diagnostics;
    }
}

// 创建全局实例
window.DebugTools = new DebugTools();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugTools;
}