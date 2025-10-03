// app-init.js — 页面初始化与全局状态逻辑（从 mobile-dashboard.html 拆分）
// 依赖：showToast, checkLoginStatus, initializeEnhancedModules, bindNavigationEvents, initializeWebSocket, loadDashboardData, initializeProfilePage, initializePageStates

// 页面初始化主流程相关函数
// 依赖：navigation.js, websocket.js, user-utils.js, message-and-conversation.js

async function initializeApp() {
    try {
        await checkLoginStatus();
        initializeEnhancedModules();
        bindNavigationEvents();
        initializeWebSocket();
        initializeEnhancedModules();
        await loadDashboardData();
        initializeProfilePage();
        initializePageStates();
        console.log('✅ 应用初始化完成');
    } catch (error) {
        console.error('❌ 应用初始化失败:', error);
        showToast('系统启动失败，请刷新页面重试', 'error');
    }
}

function initializeEnhancedModules() {
    // ...原实现代码...
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📱 QuickTalk 移动端管理系统启动');
    if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
        try { await window.PartialsLoader.loadPartials(); }
        catch (e) { console.error('❌ 组件加载失败:', e); }
    }
    initializeApp();
});
