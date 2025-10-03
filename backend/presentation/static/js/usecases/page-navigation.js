/**
 * 页面导航模块
 * 负责页面切换、状态管理、数据加载协调
 */

(function() {
    'use strict';

    // 轻薄代理 + 本地兜底，避免 UnifiedUsecases 尚未加载时出现 TypeError
    function __fallbackSwitchPage(pageName){
        try {
            const allPages = document.querySelectorAll('.page');
            allPages.forEach(page => {
                page.classList.remove('active');
                page.style.visibility = 'hidden';
                page.style.zIndex = '-1';
                page.style.display = 'none';
                page.style.pointerEvents = 'none';
            });
            const targetPage = document.getElementById(pageName + 'Page');
            if (targetPage) {
                targetPage.classList.add('active');
                targetPage.style.visibility = 'visible';
                targetPage.style.zIndex = '10';
                targetPage.style.display = 'block';
                targetPage.style.pointerEvents = 'all';
            }
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            const nav = document.querySelector(`[data-page="${pageName}"]`);
            if (nav) nav.classList.add('active');
            window.currentPage = pageName;
            if (typeof window.loadPageData === 'function') window.loadPageData(pageName);
        } catch (e) {
            console.warn('page-navigation fallback switchPage error:', e);
        }
    }

    async function __fallbackLoadPageData(pageName){
        const loadDashboardData = typeof window.loadDashboardData === 'function' ? window.loadDashboardData : null;
        const loadConversations = typeof window.loadConversations === 'function' ? window.loadConversations : null;
        const loadShops = typeof window.loadShops === 'function' ? window.loadShops : null;
        const initializeProfilePage = typeof window.initializeProfilePage === 'function' ? window.initializeProfilePage : null;
        switch (pageName) {
            case 'home':
                if (loadDashboardData) await loadDashboardData();
                break;
            case 'messages':
                if (loadConversations) await loadConversations();
                break;
            case 'shops':
                if (loadShops) await loadShops();
                break;
            case 'workbench':
                if (typeof window.loadWorkbenchSummary === 'function') await window.loadWorkbenchSummary();
                break;
            case 'profile':
                if (initializeProfilePage) initializeProfilePage();
                break;
        }
    }

    function __fallbackInitializePageStates(){
        try {
            const allPages = document.querySelectorAll('.page');
            allPages.forEach(page => {
                page.classList.remove('active');
                page.style.visibility = 'hidden';
                page.style.zIndex = '-1';
                page.style.display = 'none';
                page.style.pointerEvents = 'none';
            });
            const home = document.getElementById('homePage');
            if (home) {
                home.classList.add('active');
                home.style.visibility = 'visible';
                home.style.zIndex = '10';
                home.style.display = 'block';
                home.style.pointerEvents = 'all';
            }
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            const nav = document.querySelector('[data-page="home"]');
            if (nav) nav.classList.add('active');
            window.currentPage = 'home';
        } catch (e) {
            console.warn('page-navigation fallback initializePageStates error:', e);
        }
    }

    // 代理到 UnifiedUsecases，若未加载则采用本地兜底
    window.switchPage = function(pageName){
        if (window.UnifiedUsecases && typeof window.UnifiedUsecases.switchPage === 'function') {
            return window.UnifiedUsecases.switchPage(pageName);
        }
        return __fallbackSwitchPage(pageName);
    };
    window.loadPageData = function(pageName){
        if (window.UnifiedUsecases && typeof window.UnifiedUsecases.loadPageData === 'function') {
            return window.UnifiedUsecases.loadPageData(pageName);
        }
        return __fallbackLoadPageData(pageName);
    };
    window.initializePageStates = function(){
        if (window.UnifiedUsecases && typeof window.UnifiedUsecases.initializePageStates === 'function') {
            return window.UnifiedUsecases.initializePageStates();
        }
        return __fallbackInitializePageStates();
    };

    // 初始化个人资料页面
    window.initializeProfilePage = function() {
        console.log('🔧 初始化个人资料页面');
        
        const userData = typeof window.userData !== 'undefined' ? window.userData : null;

        // 更新用户信息显示
        if (userData) {
            // 显示/隐藏超级管理员功能
            const adminOnlySettings = document.getElementById('adminOnlySettings');
            if (adminOnlySettings) {
                if (userData.role === 'super_admin' || userData.role === 'administrator') {
                    adminOnlySettings.style.display = 'block';
                    console.log('✅ 显示超级管理员功能');
                } else {
                    adminOnlySettings.style.display = 'none';
                    console.log('❌ 隐藏超级管理员功能 - 权限不足');
                }
            }
        }
    };

    console.log('✅ 页面导航模块已加载 (page-navigation.js)');
    
    // 绑定导航事件（从 mobile-dashboard.html 抽取）
    window.bindNavigationEvents = function() {
        try {
            console.log('🔗 开始绑定导航事件...');

            // 绑定底部导航栏点击事件
            const navItems = document.querySelectorAll('.nav-item[data-page]');
            console.log(`🔗 找到 ${navItems.length} 个导航项`);
            navItems.forEach(item => {
                item.addEventListener('click', function() {
                    const page = this.getAttribute('data-page');
                    console.log(`🖱️ 点击导航项: ${page}`);
                    if (typeof window.switchPage === 'function') {
                        window.switchPage(page);
                    }
                });
            });

            // 绑定快速操作按钮事件
            const switchPageButtons = document.querySelectorAll('[data-switch-page]');
            console.log(`🔗 找到 ${switchPageButtons.length} 个快速操作按钮`);
            switchPageButtons.forEach((btn, index) => {
                const page = btn.getAttribute('data-switch-page');
                console.log(`🔗 绑定按钮 ${index + 1}: ${page}`);
                btn.addEventListener('click', function(e) {
                    console.log(`🖱️ 点击快速操作按钮: ${page}`);
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.switchPage === 'function') {
                        window.switchPage(page);
                    }
                });
            });

            // 绑定消息页面增强功能（由 app-init.js 暴露）
            if (typeof window.initializeMessagePageEnhancements === 'function') {
                window.initializeMessagePageEnhancements();
            }

            // 添加测试功能 - 检查按钮状态
            setTimeout(() => {
                console.log('🔍 延迟检查按钮状态...');
                const testButtons = document.querySelectorAll('[data-switch-page]');
                console.log(`🔍 延迟检查找到 ${testButtons.length} 个按钮`);
                testButtons.forEach((btn, i) => {
                    const page = btn.getAttribute('data-switch-page');
                    const rect = btn.getBoundingClientRect();
                    console.log(`🔍 按钮 ${i+1} (${page}): 可见=${rect.width > 0 && rect.height > 0}, 位置=${rect.top},${rect.left}`);
                });

                // 添加全局测试函数
                window.testSwitchPage = function(page) {
                    console.log(`🧪 测试切换页面: ${page}`);
                    if (typeof window.switchPage === 'function') {
                        window.switchPage(page);
                    }
                };

                // 添加按钮点击测试
                window.testButtonClick = function(buttonIndex = 0) {
                    const buttons = document.querySelectorAll('[data-switch-page]');
                    if (buttons[buttonIndex]) {
                        console.log(`🧪 模拟点击按钮 ${buttonIndex}`);
                        buttons[buttonIndex].click();
                    } else {
                        console.log(`❌ 按钮 ${buttonIndex} 不存在`);
                    }
                };

                // 添加新增店铺测试
                window.testCreateShop = function() {
                    console.log('🧪 测试新增店铺功能');
                    try {
                        if (typeof window.createNewShop === 'function') {
                            window.createNewShop();
                        }
                    } catch (error) {
                        console.error('❌ 测试新增店铺出错:', error);
                    }
                };

                // 添加关闭模态框测试
                window.testCloseShop = function() {
                    console.log('🧪 测试关闭店铺模态框');
                    try {
                        if (typeof window.hideCreateShopModal === 'function') {
                            window.hideCreateShopModal();
                        }
                    } catch (error) {
                        console.error('❌ 测试关闭模态框出错:', error);
                    }
                };

                // 添加表单提交测试
                window.testSubmitShop = function() {
                    console.log('🧪 测试提交店铺表单');
                    const form = document.getElementById('createShopForm');
                    if (form) {
                        const event = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(event);
                    } else {
                        console.error('❌ 未找到表单元素');
                    }
                };
            }, 1000);
        } catch (e) {
            console.warn('bindNavigationEvents 出错:', e);
        }
    };
})();
