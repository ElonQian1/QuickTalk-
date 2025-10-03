/*
 * UI: 店铺卡片渲染 (shop-card.js)
 * - 生成店铺卡片 DOM：名称、域名、未读计数、状态类，支持 onClick
 * - 不包含异步请求逻辑
 */
(function(){
  'use strict';

  function build(shop, options){
    options = options || {};
    var unread = Number(shop.unreadCount || 0);
    var hasConversations = !!options.hasConversations;
    var effStatus = (shop.approvalStatus || shop.status || 'pending');
    var isInactive = (effStatus === 'inactive') || (!hasConversations);

    var card = document.createElement('div');
    card.className = 'shop-card ' + (isInactive ? 'shop-card-inactive' : '');
    card.setAttribute('data-shop-id', shop.id);

    card.innerHTML = [
      '<div class="shop-header">',
        '<div class="shop-icon">', (shop.name || 'S').charAt(0) ,'</div>',
      '</div>',
      '<div class="shop-name">',
        (shop.name || '未命名店铺'),
        '<span class="unread-count" data-unread="', unread ,'" style="display:', (unread>0?'inline':'none') ,'">',
          (unread>0 ? '(' + unread + ')' : ''),
        '</span>',
      '</div>',
      '<div class="shop-domain">', (shop.domain || '未设置域名') ,'</div>',
      '<div class="shop-meta">',
        '<div class="shop-actions">', (options.actionsHTML || '') ,'</div>',
      '</div>',
      (shop.membership === 'employee' ? '<div class="shop-role-badge">员工</div>' : '')
    ].join('');

    if (typeof options.onClick === 'function') {
      card.addEventListener('click', function(evt){ options.onClick(shop, evt); });
    }
    return card;
  }

  window.ShopCardUI = { build };
  console.log('✅ UI 组件已加载 (shop-card.js)');
})();
