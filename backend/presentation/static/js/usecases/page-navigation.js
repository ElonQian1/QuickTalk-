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
