/**
 * 应用常量定义
 * 集中管理所有常量配置
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

const AppConstants = {
    // 事件名称
    EVENTS: {
        // 数据同步事件
        DATA_SYNC_START: 'data.sync.start',
        DATA_SYNC_SUCCESS: 'data.sync.success', 
        DATA_SYNC_ERROR: 'data.sync.error',
        
        // 会话事件
        SESSION_CREATED: 'session.created',
        SESSION_UPDATED: 'session.updated',
        SESSION_EXPIRED: 'session.expired',
        
        // 对话事件
        CONVERSATION_SELECTED: 'conversation.selected',
        CONVERSATION_UPDATED: 'conversation.updated',
        MESSAGE_RECEIVED: 'message.received',
        MESSAGE_SENT: 'message.sent',
        
        // 红点事件
        BADGE_UPDATE: 'badge.update',
        BADGE_CLICK: 'badge.click',
        BADGE_CLEAR: 'badge.clear',
        
        // UI事件
        NAVIGATION_CHANGE: 'navigation.change',
        MODAL_SHOW: 'modal.show',
        MODAL_HIDE: 'modal.hide',
        
        // WebSocket事件
        WS_CONNECTED: 'websocket.connected',
        WS_DISCONNECTED: 'websocket.disconnected',
        WS_MESSAGE: 'websocket.message',
        WS_ERROR: 'websocket.error'
    },

    // API 配置
    API: {
        BASE_URL: '/api',
        ENDPOINTS: {
            HEALTH: '/health',
            SHOPS: '/shops',
            CONVERSATIONS: '/conversations',
            MESSAGES: '/messages',
            UPLOAD: '/upload'
        },
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3
    },

    // WebSocket 配置
    WEBSOCKET: {
        URL: 'ws://localhost:3030/ws',
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_ATTEMPTS: 10,
        HEARTBEAT_INTERVAL: 30000
    },

    // 缓存配置
    CACHE: {
        DEFAULT_TTL: 30000,  // 30秒
        MAX_ENTRIES: 100,
        CONVERSATION_TTL: 60000,  // 1分钟
        SHOP_STATS_TTL: 30000     // 30秒
    },

    // UI 配置
    UI: {
        // 动画时长
        ANIMATION_DURATION: 300,
        FADE_DURATION: 150,
        
        // 延迟配置
        DEBOUNCE_DELAY: 300,
        THROTTLE_DELAY: 100,
        
        // 分页配置
        PAGE_SIZE: 20,
        LOAD_MORE_THRESHOLD: 5,
        
        // 红点配置
        BADGE_UPDATE_INTERVAL: 5000,
        BADGE_FADE_DURATION: 200
    },

    // 本地存储键名
    STORAGE_KEYS: {
        SESSION_DATA: 'quicktalk_session',
        USER_PREFERENCES: 'quicktalk_preferences',
        CONVERSATION_CACHE: 'quicktalk_conversations',
        LAST_ACTIVITY: 'quicktalk_last_activity'
    },

    // 错误代码
    ERROR_CODES: {
        NETWORK_ERROR: 'NETWORK_ERROR',
        API_ERROR: 'API_ERROR',
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        AUTH_ERROR: 'AUTH_ERROR',
        PERMISSION_ERROR: 'PERMISSION_ERROR',
        NOT_FOUND: 'NOT_FOUND',
        TIMEOUT: 'TIMEOUT'
    },

    // 消息类型
    MESSAGE_TYPES: {
        TEXT: 'text',
        IMAGE: 'image',
        FILE: 'file',
        SYSTEM: 'system'
    },

    // 会话状态
    SESSION_STATUS: {
        ACTIVE: 'active',
        IDLE: 'idle',
        EXPIRED: 'expired'
    },

    // 对话状态
    CONVERSATION_STATUS: {
        OPEN: 'open',
        CLOSED: 'closed',
        PENDING: 'pending'
    },

    // 用户角色
    USER_ROLES: {
        CUSTOMER: 'customer',
        AGENT: 'agent',
        ADMIN: 'admin',
        SUPER_ADMIN: 'super_admin'
    },

    // 正则表达式
    REGEX: {
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        PHONE: /^1[3-9]\d{9}$/,
        URL: /^https?:\/\/.+/,
        IMAGE_EXT: /\.(jpg|jpeg|png|gif|webp)$/i,
        FILE_EXT: /\.(pdf|doc|docx|txt|zip|rar)$/i
    },

    // 调试配置
    DEBUG: {
        ENABLED: window.location.hostname === 'localhost',
        LOG_LEVEL: 'INFO',
        SHOW_PERFORMANCE: true,
        SHOW_NETWORK: true
    }
};

// 冻结常量对象，防止意外修改
Object.freeze(AppConstants.EVENTS);
Object.freeze(AppConstants.API);
Object.freeze(AppConstants.WEBSOCKET);
Object.freeze(AppConstants.CACHE);
Object.freeze(AppConstants.UI);
Object.freeze(AppConstants.STORAGE_KEYS);
Object.freeze(AppConstants.ERROR_CODES);
Object.freeze(AppConstants.MESSAGE_TYPES);
Object.freeze(AppConstants.SESSION_STATUS);
Object.freeze(AppConstants.CONVERSATION_STATUS);
Object.freeze(AppConstants.USER_ROLES);
Object.freeze(AppConstants.REGEX);
Object.freeze(AppConstants.DEBUG);
Object.freeze(AppConstants);

// 注册到模块系统
window.registerModule('AppConstants', AppConstants);

// 全局访问
window.APP_CONSTANTS = AppConstants;

console.log('📐 应用常量已初始化');