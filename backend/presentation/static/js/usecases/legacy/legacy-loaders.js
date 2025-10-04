/**
 * legacy/legacy-loaders.js
 * 抽离自 message-module.js 的旧加载逻辑。
 * 仅做最小改动，保持原语义；后续可逐步削减或替换为新管理器实现。
 * 不直接引用 managers，全部通过注入的上下文 (ctx) 访问。
 */
(function(){
  'use strict';
  if (window.LegacyLoaders) return;

  function assertAuthFetch(){
    if (!window.AuthFetch) throw new Error('AuthFetch 未加载');
  }

  const LegacyLoaders = {
    /**
     * 旧：_legacyLoadMessages
     * @param {Object} ctx { conversationId, messageModule }
     * @returns {Promise<Array>|undefined}
     */
    async loadMessages(ctx){
      const { conversationId, messageModule } = ctx;
      if (!conversationId) return;

      // 与旧代码保持：若 messagesManager 正在加载同一对话则直接返回
      if (messageModule && messageModule.messagesManager && messageModule.messagesManager._loadingMessagesFor === conversationId) {
        return;
      }

      const container = document.getElementById('chatMessages');
      if (container) {
        container.innerHTML = '';
        if (window.UIStates && window.UIStates.showLoading) {
            window.UIStates.showLoading(container, '正在加载消息...');
        } else if (window.LoadingStatesUI && typeof window.LoadingStatesUI.spinner === 'function') {
            container.appendChild(window.LoadingStatesUI.spinner('正在加载消息...'));
        }
      }
      try {
        assertAuthFetch();
        const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations/${conversationId}/messages`);
        if (resp.ok) {
          const list = resp.data || [];
          if (messageModule) {
            messageModule.messages = list;
            messageModule.renderMessages();
          }
          return list;
        } else {
          console.error('[LegacyLoaders] 获取消息失败:', resp.error);
          if (container) {
            if (window.UIStates && window.UIStates.showError) {
              window.UIStates.showError(container, '加载消息失败', resp.error || '请稍后重试');
            } else {
              container.textContent = resp.error || '加载消息失败';
            }
          }
        }
      } catch (e) {
        console.error('[LegacyLoaders] 网络错误:', e);
        if (container && window.UIStates && window.UIStates.showError) {
          window.UIStates.showError(container, '网络错误', '无法获取消息，请检查网络连接');
        }
      }
    },

    /**
     * 旧：_legacyLoadConversationsForShop
     * @param {Object} ctx { shopId, messageModule }
     * @returns {Promise<Array>|undefined}
     */
    async loadConversationsForShop(ctx){
      const { shopId, messageModule } = ctx;
      if (!shopId) return;
      if (messageModule && messageModule.conversationsManager && messageModule.conversationsManager._loading && messageModule.conversationsManager._loadingShopId === shopId) {
        return; // 保持旧逻辑：避免重复加载
      }
      try {
        assertAuthFetch();
        const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations?shop_id=${shopId}`);
        if (resp.ok) {
          const list = Array.isArray(resp.data) ? resp.data : [];
          if (messageModule) {
            messageModule.conversations = list;
            if (messageModule.renderConversationsList) {
              messageModule.renderConversationsList();
            }
          }
          return list;
        } else {
          console.error('[LegacyLoaders] 获取对话列表失败:', resp.error);
        }
      } catch (e) {
        console.error('[LegacyLoaders] 网络错误:', e);
      }
    },

    /**
     * 旧：_legacyShowShops
     * @param {Object} ctx { messageModule }
     */
    async showShops(ctx){
      const { messageModule } = ctx;
      try {
        const shops = await (typeof fetchShops === 'function' ? fetchShops() : Promise.resolve([]));
        const arr = Array.isArray(shops) ? shops : [];
        const filterFn = (typeof window.getActiveShops === 'function') ? window.getActiveShops : (a) => a;
        if (messageModule) {
          messageModule.shops = filterFn(arr);
          if (messageModule.shopsManager && messageModule.shopsManager.renderShopsList) {
            messageModule.shopsManager.renderShopsList();
          }
        }
      } catch (e) {
        console.error('[LegacyLoaders] 获取店铺列表失败', e);
        if (messageModule) {
          messageModule.shops = [];
          if (messageModule.shopsManager && messageModule.shopsManager.renderShopsList) {
            messageModule.shopsManager.renderShopsList();
          }
        }
      }
    }
  };

  window.LegacyLoaders = LegacyLoaders;
  console.log('✅ legacy-loaders.js 加载完成');
})();
