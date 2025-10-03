/**
 * 页面导航模块
 * 负责页面切换、状态管理、数据加载协调
 */
(function() {
    'use strict';

    // 页面切换状态标志
    let isPageSwitching = false;
    let switchPageTimer = null;

    // 页面切换主函数
    window.switchPage = function(pageName) {
        console.log(`🔄 switchPage 被调用: ${pageName}, 当前页面: ${window.currentPage}`);
        
        // 清除之前的计时器
        if (switchPageTimer) {
            clearTimeout(switchPageTimer);
        }
        
        // 防抖保护
        if (isPageSwitching) {
            console.log(`⚠️ 页面正在切换中，忽略本次请求`);
            return;
        }
        
        if (pageName === window.currentPage) {
            console.log(`⚠️ 已经在页面 ${pageName}, 跳过切换`);
            return;
        }
        
        // 防抖延迟执行
        switchPageTimer = setTimeout(() => {
            isPageSwitching = true;
            console.log(`🔄 切换到页面: ${pageName}`);
            
            try {
                // 强制隐藏所有页面
                const allPages = document.querySelectorAll('.page');
                console.log(`📱 找到 ${allPages.length} 个页面元素`);
                allPages.forEach(page => {
                    page.classList.remove('active');
                    page.style.visibility = 'hidden';
                    page.style.zIndex = '-1';
                    page.style.display = 'none';
                    page.style.pointerEvents = 'none';
                    console.log(`🙈 强制隐藏页面: ${page.id}`);
                });
                
                // 显示目标页面
                const targetPage = document.getElementById(pageName + 'Page');
                console.log(`🎯 目标页面元素: ${targetPage ? targetPage.id : '未找到'}`);
                if (targetPage) {
                    targetPage.classList.add('active');
                    targetPage.style.visibility = 'visible';
                    targetPage.style.zIndex = '10';
                    targetPage.style.display = 'block';
                    targetPage.style.pointerEvents = 'all';
                    console.log(`👁️ 显示页面: ${targetPage.id}`);
                } else {
                    console.error(`❌ 未找到页面元素: ${pageName}Page`);
                    return;
                }
                
                // 更新导航栏状态
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');
                
                // 更新当前页面
                window.currentPage = pageName;
                
                // 根据页面加载相应数据
                window.loadPageData(pageName);
                
                // 导航页面切换不应该直接清除红点
                // 红点应该只在用户实际查看对话时才清除
                if (pageName === 'messages') {
                    console.log('🧭 切换到消息页面，红点保持显示等待用户查看具体对话');
                    // 不再直接隐藏红点，让 NavBadgeManager 处理
                }
            } catch (error) {
                console.error('❌ 页面切换出错:', error);
            } finally {
                // 延迟重置切换标志，防止过快连续切换
                setTimeout(() => {
                    isPageSwitching = false;
                    console.log('✅ 页面切换完成，重置标志');
                }, 100);
            }
        }, 50); // 防抖延迟50ms
    };

    // 根据页面加载数据
    window.loadPageData = async function(pageName) {
        const loadDashboardData = typeof window.loadDashboardData === 'function' ? window.loadDashboardData : null;
        const loadConversations = typeof window.loadConversations === 'function' ? window.loadConversations : null;
        const loadShops = typeof window.loadShops === 'function' ? window.loadShops : null;
        const loadWorkbenchSummary = typeof window.loadWorkbenchSummary === 'function' ? window.loadWorkbenchSummary : null;
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
                if (loadWorkbenchSummary) await loadWorkbenchSummary();
                break;
            case 'profile':
                // 个人资料页面 - 初始化用户信息和权限
                if (initializeProfilePage) initializeProfilePage();
                break;
        }
    };

    // 初始化页面状态，确保只有首页显示
    window.initializePageStates = function() {
        console.log('🔧 初始化页面状态');
        
        // 强制隐藏所有页面
        const allPages = document.querySelectorAll('.page');
        allPages.forEach(page => {
            page.classList.remove('active');
            page.style.visibility = 'hidden';
            page.style.zIndex = '-1';
            page.style.display = 'none';
            page.style.pointerEvents = 'none';
            console.log(`🙈 强制隐藏页面: ${page.id}`);
        });
        
        // 显示首页
        const homePage = document.getElementById('homePage');
        if (homePage) {
            homePage.classList.add('active');
            homePage.style.visibility = 'visible';
            homePage.style.zIndex = '10';
            homePage.style.display = 'block';
            homePage.style.pointerEvents = 'all';
            console.log('✅ 首页已激活');
        }
        
        // 设置首页导航为激活状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector('[data-page="home"]')?.classList.add('active');
        
        // 确保当前页面状态
        window.currentPage = 'home';
        console.log('✅ 页面状态初始化完成');
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
})();
