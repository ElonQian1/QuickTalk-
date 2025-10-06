// QuickTalk ClientSessionManager - 已重构为适配器
class QuickTalkClientSessionManager {
    constructor() {
        this.storageKey = "qt_customer_id";
        this.userId = null;
        this.init();
    }
    
    init() {
        if (window.unifiedSessionManager) {
            this.userId = window.unifiedSessionManager.getOrCreateCustomerId();
        } else {
            this.userId = this.getOrCreateUserId();
        }
        console.log("QuickTalk客户端适配器已加载:", this.userId);
    }
    
    getOrCreateUserId() {
        let userId = localStorage.getItem(this.storageKey);
        if (!userId) {
            userId = "customer_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
            localStorage.setItem(this.storageKey, userId);
        }
        return userId;
    }
    
    getCurrentUserId() { return this.userId; }
}

window.QuickTalkClientSessionManager = QuickTalkClientSessionManager;
