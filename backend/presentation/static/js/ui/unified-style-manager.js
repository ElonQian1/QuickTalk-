/**
 * 统一样式管理系统
 * 整合并替代重复的样式注入模块
 * 
 * 解决的重复模式:
 * - connection-indicator.js (连接状态样式)
 * - keyboard-safe-area.js (键盘安全区样式)
 * - search-highlight.js (搜索高亮样式)
 * - status-view.js (状态视图样式)
 * - 以及其他使用独立 injectStyle() 的模块
 * 
 * 依赖:
 * - UIBase (继承标准化能力)
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-06
 */

class UnifiedStyleManager extends UIBase {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 全局配置
            enableConflictDetection: true,
            enableDebugMode: false,
            
            // 样式分组配置
            enableConnectionIndicator: true,
            enableKeyboardSafeArea: true,
            enableSearchHighlight: true,
            enableStatusView: true,
            
            ...options
        };

        // 样式注册表
        this.registeredStyles = new Map(); // styleId -> { content, dependencies, meta }
        this.activeStyles = new Set(); // 当前活动的样式ID
        this.conflictMap = new Map(); // 冲突检测映射
        
        this.init();
    }

    init() {
        this.log('info', '统一样式管理系统初始化');
        
        // 注册核心UI样式
        this.registerCoreStyles();
        
        // 应用默认启用的样式
        this.applyDefaultStyles();
        
        // 初始化事件监听
        this.initEventListeners();
    }

    /**
     * 注册核心UI样式
     * 整合原有模块的样式定义
     */
    registerCoreStyles() {
        // 连接指示器样式 (来自connection-indicator.js)
        this.registerStyle('connection-indicator', {
            content: `
                #qt-connection-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 9999;
                    padding: 8px 16px;
                    text-align: center;
                    font-size: 13px;
                    color: #fff;
                    display: none;
                    transition: transform 0.3s ease, opacity 0.3s ease;
                }
                
                #qt-connection-indicator.show {
                    display: block;
                    transform: translateY(0);
                    opacity: 1;
                }
                
                #qt-connection-indicator.hide {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                
                #qt-connection-indicator .icon {
                    margin-right: 6px;
                    display: inline-block;
                    animation: qt-connection-spin 1s linear infinite;
                }
                
                @keyframes qt-connection-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* 连接状态颜色 */
                #qt-connection-indicator.connecting { background: #ffa502; }
                #qt-connection-indicator.connected { background: #26de81; }
                #qt-connection-indicator.disconnected { background: #ff4757; }
                #qt-connection-indicator.reconnecting { background: #ff6348; }
            `,
            category: 'indicator',
            dependencies: [],
            description: 'WebSocket连接状态指示器样式'
        });

        // 键盘安全区样式 (来自keyboard-safe-area.js)
        this.registerStyle('keyboard-safe-area', {
            content: `
                #chatMessages.keyboard-active {
                    transition: padding-bottom 0.2s ease;
                }
                
                .bottom-nav.keyboard-active {
                    transition: transform 0.2s ease;
                }
                
                /* 键盘弹出时的适配 */
                .keyboard-aware-container {
                    transition: all 0.2s ease;
                }
                
                .keyboard-spacer {
                    transition: height 0.2s ease;
                    height: 0;
                    overflow: hidden;
                }
                
                @media (max-width: 768px) {
                    .keyboard-aware-container.active {
                        padding-bottom: env(keyboard-inset-height, 0);
                    }
                }
            `,
            category: 'mobile',
            dependencies: [],
            description: '移动端键盘安全区适配样式'
        });

        // 搜索高亮样式 (来自search-highlight.js)
        this.registerStyle('search-highlight', {
            content: `
                .qt-search-highlight {
                    background: linear-gradient(transparent 60%, rgba(255, 235, 59, 0.8) 60%);
                    padding: 0 2px;
                    border-radius: 2px;
                    transition: background-color 0.2s ease;
                }
                
                .qt-search-highlight.exact-match {
                    background: rgba(255, 235, 59, 0.9);
                    font-weight: 500;
                }
                
                .qt-search-highlight.partial-match {
                    background: linear-gradient(transparent 70%, rgba(255, 235, 59, 0.6) 70%);
                }
                
                /* 搜索结果计数 */
                .search-results-count {
                    font-size: 12px;
                    color: #666;
                    margin-left: 8px;
                }
                
                /* 高亮动画 */
                @keyframes highlight-flash {
                    0%, 100% { background-color: rgba(255, 235, 59, 0.8); }
                    50% { background-color: rgba(255, 193, 7, 0.9); }
                }
                
                .qt-search-highlight.flash {
                    animation: highlight-flash 0.6s ease-in-out;
                }
            `,
            category: 'search',
            dependencies: [],
            description: '搜索文本高亮显示样式'
        });

        // 状态视图样式 (来自status-view.js)
        this.registerStyle('status-view', {
            content: `
                .qt-status-view-wrapper {
                    position: relative;
                    width: 100%;
                    min-height: 60px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                
                .qt-status-view-wrapper .loading-state {
                    text-align: center;
                    padding: 32px 12px;
                    color: #555;
                    font-size: 14px;
                }
                
                .qt-status-view-wrapper .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: #666;
                }
                
                .qt-status-view-wrapper .empty-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.6;
                }
                
                .qt-status-view-wrapper .empty-title {
                    font-size: 16px;
                    font-weight: 500;
                    margin-bottom: 8px;
                    color: #333;
                }
                
                .qt-status-view-wrapper .empty-desc {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 16px;
                }
                
                .qt-status-view-wrapper .error-message {
                    text-align: center;
                    padding: 32px 20px;
                    color: #e74c3c;
                }
                
                .qt-status-view-wrapper .status-retry-btn {
                    margin-top: 12px;
                    background: #2563eb;
                    color: #fff;
                    border: 0;
                    border-radius: 4px;
                    padding: 8px 16px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }
                
                .qt-status-view-wrapper .status-retry-btn:hover {
                    background: #1d4ed8;
                }
                
                .qt-status-view-wrapper .status-retry-btn:active {
                    transform: translateY(1px);
                }
            `,
            category: 'status',
            dependencies: [],
            description: '状态视图展示样式 (加载/空态/错误)'
        });

        // 通用UI增强样式
        this.registerStyle('ui-enhancements', {
            content: `
                /* 通用过渡动画 */
                .ui-fade-in {
                    animation: ui-fade-in 0.3s ease-out;
                }
                
                .ui-slide-down {
                    animation: ui-slide-down 0.3s ease-out;
                }
                
                .ui-pulse {
                    animation: ui-pulse 2s infinite;
                }
                
                @keyframes ui-fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes ui-slide-down {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                
                @keyframes ui-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                /* 通用状态类 */
                .ui-hidden { display: none !important; }
                .ui-visible { display: block !important; }
                .ui-loading { pointer-events: none; opacity: 0.6; }
                .ui-disabled { pointer-events: none; opacity: 0.5; }
                
                /* 响应式工具类 */
                @media (max-width: 768px) {
                    .ui-desktop-only { display: none !important; }
                    .ui-mobile-only { display: block !important; }
                }
                
                @media (min-width: 769px) {
                    .ui-desktop-only { display: block !important; }
                    .ui-mobile-only { display: none !important; }
                }
            `,
            category: 'utility',
            dependencies: [],
            description: '通用UI增强工具样式'
        });

        this.log('info', '已注册', this.registeredStyles.size, '个核心样式模块');
    }

    /**
     * 注册样式模块
     */
    registerStyle(styleId, config) {
        if (this.registeredStyles.has(styleId)) {
            this.log('warn', '样式模块已存在，将覆盖:', styleId);
        }

        const styleConfig = {
            content: '',
            category: 'custom',
            dependencies: [],
            description: '',
            version: '1.0',
            ...config,
            createdAt: Date.now()
        };

        this.registeredStyles.set(styleId, styleConfig);
        
        if (this.options.enableDebugMode) {
            this.log('debug', '注册样式模块:', styleId, styleConfig);
        }

        return styleId;
    }

    /**
     * 应用样式模块
     */
    applyStyle(styleId) {
        const styleConfig = this.registeredStyles.get(styleId);
        if (!styleConfig) {
            this.log('error', '样式模块不存在:', styleId);
            return false;
        }

        // 检查依赖
        for (const dep of styleConfig.dependencies) {
            if (!this.activeStyles.has(dep)) {
                this.log('info', '自动应用依赖样式:', dep);
                this.applyStyle(dep);
            }
        }

        // 冲突检测
        if (this.options.enableConflictDetection) {
            this.detectConflicts(styleId, styleConfig);
        }

        // 注入样式
        this.injectCSS(styleConfig.content, `unified-style-${styleId}`);
        this.activeStyles.add(styleId);

        this.log('info', '应用样式模块:', styleId);
        return true;
    }

    /**
     * 移除样式模块
     */
    removeStyle(styleId) {
        const styleElement = document.getElementById(`unified-style-${styleId}`);
        if (styleElement) {
            styleElement.remove();
        }
        
        this.activeStyles.delete(styleId);
        this.log('info', '移除样式模块:', styleId);
        
        return true;
    }

    /**
     * 应用默认样式
     */
    applyDefaultStyles() {
        const defaultStyles = [];
        
        if (this.options.enableConnectionIndicator) defaultStyles.push('connection-indicator');
        if (this.options.enableKeyboardSafeArea) defaultStyles.push('keyboard-safe-area');
        if (this.options.enableSearchHighlight) defaultStyles.push('search-highlight');
        if (this.options.enableStatusView) defaultStyles.push('status-view');
        
        // 总是应用UI增强样式
        defaultStyles.push('ui-enhancements');

        defaultStyles.forEach(styleId => this.applyStyle(styleId));
    }

    /**
     * 冲突检测
     */
    detectConflicts(styleId, styleConfig) {
        // 简单的选择器冲突检测
        const selectors = this.extractSelectors(styleConfig.content);
        
        for (const [activeId, activeConfig] of this.registeredStyles) {
            if (activeId === styleId || !this.activeStyles.has(activeId)) continue;
            
            const activeSelectors = this.extractSelectors(activeConfig.content);
            const conflicts = selectors.filter(sel => activeSelectors.includes(sel));
            
            if (conflicts.length > 0) {
                this.log('warn', '检测到样式冲突:', {
                    newStyle: styleId,
                    conflictWith: activeId,
                    selectors: conflicts
                });
                
                this.conflictMap.set(`${styleId}-${activeId}`, conflicts);
            }
        }
    }

    /**
     * 提取CSS选择器 (简化版)
     */
    extractSelectors(cssContent) {
        const selectors = [];
        const matches = cssContent.match(/[^{}]+(?=\s*{)/g);
        
        if (matches) {
            matches.forEach(match => {
                const cleanSelector = match.trim().split(',').map(s => s.trim());
                selectors.push(...cleanSelector);
            });
        }
        
        return selectors;
    }

    /**
     * 获取样式状态
     */
    getStyleStatus() {
        return {
            registered: Array.from(this.registeredStyles.keys()),
            active: Array.from(this.activeStyles),
            conflicts: Array.from(this.conflictMap.entries()),
            totalRegistered: this.registeredStyles.size,
            totalActive: this.activeStyles.size
        };
    }

    /**
     * 批量应用样式
     */
    applyStyles(styleIds) {
        const results = styleIds.map(styleId => ({
            styleId,
            success: this.applyStyle(styleId)
        }));
        
        const successCount = results.filter(r => r.success).length;
        this.log('info', `批量应用样式完成: ${successCount}/${styleIds.length}`);
        
        return results;
    }

    /**
     * 重置所有样式
     */
    resetStyles() {
        const activeStyles = Array.from(this.activeStyles);
        activeStyles.forEach(styleId => this.removeStyle(styleId));
        
        this.activeStyles.clear();
        this.conflictMap.clear();
        
        this.log('info', '已重置所有样式');
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 页面卸载时清理
        this.addEventListener(window, 'beforeunload', () => {
            this.resetStyles();
        });

        // 主题切换支持
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.addEventListener(darkModeQuery, 'change', () => {
                this.log('info', '检测到系统主题变化');
                // 可在此处添加主题切换逻辑
            });
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 清理所有样式
        this.resetStyles();
        
        // 清理注册表
        this.registeredStyles.clear();

        // 调用父类销毁
        super.destroy();

        this.log('info', '统一样式管理系统已销毁');
    }
}

// 全局单例
window.UnifiedStyleManager = UnifiedStyleManager;

// 兼容性：提供旧API接口
window.StyleUtils = {
    inject: (styleId, content) => {
        if (!window.unifiedStyleManager) {
            window.unifiedStyleManager = new UnifiedStyleManager();
        }
        window.unifiedStyleManager.registerStyle(styleId, { content });
        return window.unifiedStyleManager.applyStyle(styleId);
    },
    remove: (styleId) => {
        if (!window.unifiedStyleManager) return false;
        return window.unifiedStyleManager.removeStyle(styleId);
    }
};

// 兼容原有模块的函数
window.ConnectionIndicatorUI = {
    init: () => {
        if (!window.unifiedStyleManager) {
            window.unifiedStyleManager = new UnifiedStyleManager();
        }
        window.unifiedStyleManager.applyStyle('connection-indicator');
    }
};

window.KeyboardSafeAreaUI = {
    init: () => {
        if (!window.unifiedStyleManager) {
            window.unifiedStyleManager = new UnifiedStyleManager();
        }
        window.unifiedStyleManager.applyStyle('keyboard-safe-area');
    }
};

window.SearchHighlightUI = {
    init: () => {
        if (!window.unifiedStyleManager) {
            window.unifiedStyleManager = new UnifiedStyleManager();
        }
        window.unifiedStyleManager.applyStyle('search-highlight');
    }
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.unifiedStyleManager = new UnifiedStyleManager();
    });
} else {
    window.unifiedStyleManager = new UnifiedStyleManager();
}

console.log('✅ 统一样式管理系统已加载 (UnifiedStyleManager)');