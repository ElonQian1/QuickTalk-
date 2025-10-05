/**
 * 未读数管理模块
 * 负责店铺未读消息红点的更新和显示
 */
(function() {
    'use strict';

    // 更新店铺红点显示
    window.updateShopBadgeDisplay = function(shopCard, unreadCount) {
        if (!shopCard) return;

        const unreadBadge = shopCard.querySelector('.shop-unread-badge') || shopCard.querySelector('.unread-count');
        if (unreadBadge) {
            const count = Number(unreadCount || 0);
            unreadBadge.setAttribute('data-unread', count);
            
            if (count > 0) {
                if (unreadBadge.classList.contains('shop-unread-badge')) {
                    unreadBadge.style.display = 'flex';
                    const numberEl = unreadBadge.querySelector('.unread-number');
                    if (numberEl) numberEl.textContent = count;
                } else {
                    unreadBadge.style.display = 'inline';
                    unreadBadge.textContent = `(${count})`;
                }
            } else {
                unreadBadge.style.display = 'none';
                if (unreadBadge.classList.contains('shop-unread-badge')) {
                    const numberEl = unreadBadge.querySelector('.unread-number');
                    if (numberEl) numberEl.textContent = '0';
                } else {
                    unreadBadge.textContent = '';
                }
            }
            
            console.log(`🔔 更新店铺未读数: ${shopCard.getAttribute('data-shop-id')}, 未读数: ${count}`);
        }
    };
    
    // 移动端店铺未读消息更新函数
    window.updateMobileShopUnreadBadges = async function() {
        console.log('🔄 移动端: 更新店铺未读消息红点...');
        
        // 获取当前页面中的所有店铺卡片
        const shopCards = document.querySelectorAll('.shop-card[data-shop-id]');
        
        for (const shopCard of shopCards) {
            const shopId = shopCard.getAttribute('data-shop-id');
            
            // 检查是否为临时ID，添加安全检查
            const isTempShop = (id) => typeof id === 'string' && id.startsWith('temp-shop-');
            
            if (shopId && !isTempShop(shopId)) {
                try {
                    // 确保 mobileDataSyncManager 存在
                    if (!window.mobileDataSyncManager) {
                        console.warn('⚠️ mobileDataSyncManager 未初始化');
                        return;
                    }
                    
                    // 获取店铺统计数据并更新红点
                    const stats = await window.mobileDataSyncManager.forceRefreshShopStats(shopId);
                    if (stats) {
                        console.log(`✅ 移动端店铺 ${shopId} 未读消息已更新: ${stats.unread_count}`);
                        
                        // 手动更新红点显示
                        if (typeof window.updateShopBadgeDisplay === 'function') {
                            window.updateShopBadgeDisplay(shopCard, stats.unread_count);
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ 移动端更新店铺 ${shopId} 未读消息失败:`, error);
                }
            }
        }
    };

    // DOM 加载完成后初始化
    function initUnreadBadges() {
        console.log('🔄 移动端初始化店铺未读消息红点更新...');
        
        // 页面加载完成后立即更新一次
        setTimeout(() => {
            if (typeof window.updateMobileShopUnreadBadges === 'function') {
                window.updateMobileShopUnreadBadges();
            }
        }, 2000); // 移动端延迟更长时间确保 DOM 已经渲染
        
        // 每30秒更新一次未读消息红点
        setInterval(() => {
            if (typeof window.updateMobileShopUnreadBadges === 'function') {
                window.updateMobileShopUnreadBadges();
            }
        }, 30000);
        
        // 监听店铺数据刷新事件，当店铺列表更新时也更新红点
        const shopsList = document.querySelector('.shops-list, #shopsList, .shop-list');
        if (shopsList) {
            const observer = new MutationObserver(function(mutations) {
                let shouldUpdate = false;
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        // 检查是否有新的店铺卡片被添加
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1 && (node.classList.contains('shop-card') || node.querySelector('.shop-card'))) {
                                shouldUpdate = true;
                            }
                        });
                    }
                });
                
                if (shouldUpdate) {
                    console.log('🔄 检测到店铺列表更新，刷新未读消息红点...');
                    setTimeout(() => {
                        if (typeof window.updateMobileShopUnreadBadges === 'function') {
                            window.updateMobileShopUnreadBadges();
                        }
                    }, 500); // 延迟500ms确保DOM更新完成
                }
            });
            
            // 开始观察
            observer.observe(shopsList, {
                childList: true,
                subtree: true
            });
            
            console.log('✅ 店铺列表变化监听器已启动');
        }
    }

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUnreadBadges);
    } else {
        initUnreadBadges();
    }

    console.log('✅ 未读数管理模块已加载 (unread-badges.js)');
})();
