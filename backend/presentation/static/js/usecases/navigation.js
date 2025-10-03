// navigation.js — 页面导航与切换逻辑（从 mobile-dashboard.html 拆分）
// 依赖：app-init.js, message-and-conversation.js

let switchPageTimer = null;

function bindNavigationEvents() {
    // ...原实现代码...
}

function switchPage(pageName) {
    console.log(`🔄 switchPage 被调用: ${pageName}, 当前页面: ${window.currentPage}`);
    if (switchPageTimer) clearTimeout(switchPageTimer);
    if (window.isPageSwitching) {
        console.log(`⚠️ 页面正在切换中，忽略本次请求`);
        return;
    }
    if (pageName === window.currentPage) {
        console.log(`⚠️ 已经在页面 ${pageName}, 跳过切换`);
        return;
    }
    switchPageTimer = setTimeout(() => {
        window.isPageSwitching = true;
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
            } else {
                console.error(`❌ 未找到页面元素: ${pageName}Page`);
                return;
            }
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');
            window.currentPage = pageName;
            loadPageData(pageName);
            if (pageName === 'messages') {
                // 红点逻辑交由 NavBadgeManager 处理
            }
        } catch (error) {
            console.error('❌ 页面切换出错:', error);
        } finally {
            setTimeout(() => {
                window.isPageSwitching = false;
                console.log('✅ 页面切换完成，重置标志');
            }, 100);
        }
    }, 50);
}

function initializePageStates() {
    // ...原实现代码...
}

function initializeProfilePage() {
    // ...原实现代码...
}

async function loadPageData(pageName) {
    // ...原实现代码...
}
