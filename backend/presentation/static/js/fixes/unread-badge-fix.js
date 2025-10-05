// unread-badge-fix.js
// 临时强制显示底部导航“消息”未读红点的兜底脚本
// 已被全局配置/聚合方案替代方向：推荐改用 UnreadBadgeAggregator + 真正的服务端未读统计。
// 保留此脚本仅用于在早期开发或后端未读接口缺失时强制展示，受特性开关控制。
// 开关：QT_CONFIG.features.forceUnreadFallback === true 才会启用。
// 若需手工启用：在控制台执行：QT_CONFIG.features.forceUnreadFallback = true; forceShowUnreadBadge();
(function() {
    'use strict';

    const ns = 'unreadFix';
    const log = (lvl, ...a) => {
        if (window.QT_LOG) {
            (QT_LOG[lvl]||QT_LOG.info)(ns, ...a);
        } else {
            console.log(`[${ns}]`, ...a);
        }
    };

    // 如果全局配置存在且未开启特性，则直接退出
    if (window.QT_CONFIG && !window.QT_CONFIG.features.forceUnreadFallback) {
        log('info', '未启用 forceUnreadFallback，脚本跳过执行');
        return;
    }

    log('info', '强制未读消息红点显示修复已启动');
    
    function forceShowUnreadBadge() {
        // 获取消息红点元素
        const messagesBadge = document.getElementById('messagesBadge');
        if (!messagesBadge) {
            console.warn('⚠️ 找不到消息红点元素 #messagesBadge');
            return;
        }
        
        // 检查是否有实际的未读消息
        let totalUnread = 0;
        
        // 方法1：从店铺卡片统计未读数
        const shopCards = document.querySelectorAll('.shop-card');
        shopCards.forEach(card => {
            const unreadElements = card.querySelectorAll('.unread-count, .unread-badge, .shop-unread-badge');
            unreadElements.forEach(el => {
                const count = parseInt(el.textContent) || parseInt(el.getAttribute('data-unread')) || 0;
                if (count > 0) {
                    totalUnread += count;
                }
            });
        });
        
        // 方法2：检查DOM中是否有明确的未读数据
        const unreadCountElements = document.querySelectorAll('[data-unread], [data-unread-count]');
        unreadCountElements.forEach(el => {
            const count = parseInt(el.getAttribute('data-unread')) || parseInt(el.getAttribute('data-unread-count')) || 0;
            if (count > 0) {
                totalUnread += count;
            }
        });
        
        // 方法3：如果没有明确的未读数据，但有对话，设置一个默认值
        if (totalUnread === 0) {
            const conversationItems = document.querySelectorAll('.conversation-item, .shop-card[data-shop-id]');
            if (conversationItems.length > 0) {
                // 模拟未读消息，实际应用中这应该从服务器获取
                totalUnread = Math.min(conversationItems.length, 3); // 最多显示3个未读
            }
        }
        
        // 更新红点显示
        if (totalUnread > 0) {
            messagesBadge.textContent = totalUnread > 99 ? '99+' : totalUnread.toString();
            messagesBadge.classList.remove('hidden');
            messagesBadge.style.display = 'flex';
            log('debug', `显示未读消息红点: ${totalUnread}`);
        } else {
            messagesBadge.classList.add('hidden');
            messagesBadge.style.display = 'none';
            log('debug', '无未读消息，隐藏红点');
        }
        
        return totalUnread;
    }
    
    function setupAutoRefresh() {
        // 定期检查并更新红点
        setInterval(forceShowUnreadBadge, 3000); // 每3秒检查一次
        
        // 监听DOM变化
        const observer = new MutationObserver(() => {
            setTimeout(forceShowUnreadBadge, 200);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    function init() {
        // 立即执行一次
        setTimeout(forceShowUnreadBadge, 500);
        
        // 设置自动刷新
        setupAutoRefresh();
        
        // 绑定到全局对象，方便调试
        window.forceShowUnreadBadge = forceShowUnreadBadge;
        
        log('info', '未读消息红点修复已初始化');
        log('debug', '可使用 forceShowUnreadBadge() 手动刷新；系统每3秒自动检查');
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();