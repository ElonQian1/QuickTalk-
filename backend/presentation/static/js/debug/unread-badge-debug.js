// 未读消息红点调试工具
window.debugUnreadBadge = function() {
    console.log('=== 未读消息红点调试 ===');
    
    // 1. 检查导航栏红点元素
    const messagesBadge = document.getElementById('messagesBadge');
    console.log('消息红点元素:', messagesBadge);
    
    if (messagesBadge) {
        console.log('红点类名:', messagesBadge.className);
        console.log('红点内容:', messagesBadge.textContent);
        console.log('红点样式:', {
            display: getComputedStyle(messagesBadge).display,
            visibility: getComputedStyle(messagesBadge).visibility
        });
    }
    
    // 2. 检查NavBadgeManager
    console.log('NavBadgeManager:', window.navBadgeManager);
    console.log('NavBadgeManager类:', window.NavBadgeManager);
    
    // 3. 检查NavUnreadAggregator
    console.log('NavUnreadAggregator:', window.NavUnreadAggregator);
    
    // 4. 检查店铺卡片的未读数
    const shopCards = document.querySelectorAll('.shop-card');
    console.log('店铺卡片数量:', shopCards.length);
    
    let totalUnread = 0;
    shopCards.forEach((card, index) => {
        const shopId = card.getAttribute('data-shop-id');
        const unreadBadges = card.querySelectorAll('.unread-badge, .shop-unread-badge, .unread-badge-component');
        
        unreadBadges.forEach(badge => {
            const count = parseInt(badge.textContent) || parseInt(badge.getAttribute('data-count')) || parseInt(badge.getAttribute('data-unread-count')) || 0;
            totalUnread += count;
            
            if (count > 0) {
                console.log(`店铺 ${shopId} (卡片${index}) 未读消息:`, count, badge);
            }
        });
    });
    
    console.log('总未读消息数:', totalUnread);
    
    // 5. 手动触发红点更新
    console.log('🔄 手动触发红点更新...');
    
    if (window.NavUnreadAggregator) {
        window.NavUnreadAggregator.refresh();
    }
    
    if (window.navBadgeManager) {
        window.navBadgeManager.updateNavBadge('messages', totalUnread);
    }
    
    // 6. 强制显示红点（用于测试）
    if (messagesBadge) {
        messagesBadge.textContent = totalUnread > 0 ? totalUnread.toString() : '5';
        messagesBadge.classList.remove('hidden');
        messagesBadge.style.display = 'flex';
        console.log('✅ 强制显示红点，数量:', messagesBadge.textContent);
    }
    
    return {
        badge: messagesBadge,
        totalUnread: totalUnread,
        shopCards: shopCards.length
    };
};

// 重置红点（隐藏）
window.resetUnreadBadge = function() {
    const messagesBadge = document.getElementById('messagesBadge');
    if (messagesBadge) {
        messagesBadge.classList.add('hidden');
        messagesBadge.style.display = 'none';
        messagesBadge.textContent = '';
        console.log('🔒 红点已重置为隐藏状态');
    }
};

// 模拟未读消息
window.simulateUnreadMessages = function(count = 3) {
    const messagesBadge = document.getElementById('messagesBadge');
    if (messagesBadge) {
        messagesBadge.textContent = count.toString();
        messagesBadge.classList.remove('hidden');
        messagesBadge.style.display = 'flex';
        console.log(`📩 模拟 ${count} 条未读消息`);
    }
    
    // 如果有NavBadgeManager，也通过它更新
    if (window.navBadgeManager) {
        window.navBadgeManager.updateNavBadge('messages', count);
    }
};

// 页面加载完成后注册调试工具
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            console.log('📱 未读消息红点调试工具已加载');
            console.log('使用 debugUnreadBadge() 检查未读消息状态');
            console.log('使用 simulateUnreadMessages(5) 模拟5条未读消息');
            console.log('使用 resetUnreadBadge() 重置红点');
        }, 1000);
    });
} else {
    setTimeout(() => {
        console.log('📱 未读消息红点调试工具已加载');
        console.log('使用 debugUnreadBadge() 检查未读消息状态');
        console.log('使用 simulateUnreadMessages(5) 模拟5条未读消息');
        console.log('使用 resetUnreadBadge() 重置红点');
    }, 1000);
}