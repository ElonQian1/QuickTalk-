/*
 * 兼容层：RealtimeDataManager（薄代理 → UnifiedDataSyncManager）
 * - 保留旧全局名与方法，内部委托给统一的数据同步管理器
 * - 统一 WS 事件转发：仍监听 websocket-message，自行降级不抛错
 */
(function(){
  'use strict';

  function getUDSM(){
    // 统一获取统一数据同步管理器实例
    // window.unifiedDataSyncManager 由 registerModule/getModule 暴露
    return window.unifiedDataSyncManager || window.DataSyncManager || null;
  }

  var _debug = false;
  function debug(){ if (_debug) { var args = Array.prototype.slice.call(arguments); args.unshift('🔍 RealtimeDataManager(proxy):'); console.log.apply(console, args); } }

  var RealtimeDataManager = {
    enableDebugMode: function(){ _debug = true; debug('debug on'); },
    initialize: function(){
      debug('initialize');
      try {
        // WS 事件桥仍然生效：从自定义事件转发到 UDSM
        if (window.addEventListener) {
          window.addEventListener('websocket-message', function(evt){
            try {
              var uds = getUDSM();
              var payload = evt && evt.detail;
              if (!uds || !payload) return;
              // 统一委托入口，内部自行分发
              if (typeof uds.handleWsMessage === 'function') {
                uds.handleWsMessage(payload);
              }
            } catch(e){ debug('ws forward error', e); }
          });
        }
        // 定时刷新委托（尽量减少自身状态）
        setInterval(function(){ try { var uds = getUDSM(); if (uds && typeof uds.getCacheStats==='function') uds.getCacheStats(); } catch(_){} }, 30000);
      } catch(e){ debug('initialize error', e); }
      return this;
    },
    // 兼容旧 API：刷新全部店铺统计
    refreshAllShopStats: function(){
      try {
        var uds = getUDSM();
        if (!uds || typeof uds.forceRefresh !== 'function') return;
        // 遍历 DOM 中 shopId 并依次刷新
        document.querySelectorAll('[data-shop-id]').forEach(function(el){
          var id = el.getAttribute('data-shop-id');
          if (id && !String(id).startsWith('temp-shop-')) uds.forceRefresh('shop_stats', id);
        });
      } catch(e){ debug('refreshAllShopStats error', e); }
    },
    // 兼容旧 API：刷新单个店铺统计
    refreshShopStats: function(shopId){ try { var uds = getUDSM(); if (uds && typeof uds.forceRefresh==='function') return uds.forceRefresh('shop_stats', shopId); } catch(e){ debug('refreshShopStats error', e); } },
    // 兼容旧 API：更新店铺统计 DOM
    updateShopStatsDOM: function(shopId, stats){ try { var uds = getUDSM(); if (uds && typeof uds.updateShopStatsDOM==='function') return uds.updateShopStatsDOM(shopId, stats); } catch(e){ debug('updateShopStatsDOM error', e); } },
    // 兼容旧 API：更新对话显示（最小委托）
    updateConversationData: function(conv){
      try {
        // 先做最小 UI 更新（保留旧效果）
        var id = conv && (conv.id || conv.conversation_id);
        if (!id) return;
        var lastMsgEls = document.querySelectorAll('[data-conversation-id="'+id+'"] .last-message');
        lastMsgEls.forEach(function(el){ el.textContent = (conv.last_message || conv.content || '等待客户消息...'); });
        var timeEls = document.querySelectorAll('[data-conversation-id="'+id+'"] .message-time');
        var t = conv.last_message_time || conv.created_at; if (t) { var txt = new Date(t).toLocaleString(); timeEls.forEach(function(el){ el.textContent = txt; }); }
      } catch(e){ debug('updateConversationData error', e); }
    },
    clearCache: function(){ try { var uds = getUDSM(); if (uds && typeof uds.clearAllCaches==='function') uds.clearAllCaches(); } catch(e){ debug('clearCache error', e); } },
    getDebugInfo: function(){ try { var uds = getUDSM(); return uds && typeof uds.getCacheStats==='function' ? uds.getCacheStats() : {}; } catch(e){ debug('getDebugInfo error', e); return {}; } }
  };

  // 全局暴露（保持旧名）
  window.RealtimeDataManager = RealtimeDataManager;
  // 旧辅助函数
  window.updateConversationDisplay = function(conversationId, data){ try { return RealtimeDataManager.updateConversationData(Object.assign({ id: conversationId }, data||{})); } catch(_){} };
  window.updateShopStats = function(shopId, stats){ try { return RealtimeDataManager.updateShopStatsDOM(shopId, stats); } catch(_){} };

  console.log('✅ RealtimeDataManager 兼容层已加载（→ UnifiedDataSyncManager 代理）');
})();