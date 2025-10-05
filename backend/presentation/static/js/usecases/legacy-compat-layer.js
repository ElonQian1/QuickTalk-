/**
 * legacy-compat-layer.js
 * 兼容层：集中 MessageModule 中的 legacy 方法，为安全下线做准备
 * 目标：将主模块的兼容逻辑迁移至此，形成统一的废弃/迁移管理点
 * 特性：
 *  - 统一 warn 提示（废弃警告）
 *  - 保持与主模块相同的接口签名
 *  - 可独立下线或替换
 *  - 统计使用频次（配合 _legacyUsage）
 */
(function(){
  'use strict';
  if (window.MessageLegacyCompat) return; // 幂等

  const LOG_PREFIX = '[LegacyCompat]';
  function warn(){ try { console.warn(LOG_PREFIX, ...arguments); } catch(_){ } }

  class MessageLegacyCompat {
    constructor(messageModuleInstance) {
      this.mm = messageModuleInstance;
    }

    /**
     * @deprecated 原有消息加载逻辑（降级使用）
     */
    async loadMessages(conversationId) {
      warn('_legacyLoadMessages 已废弃，请使用 messagesManager.loadMessages');
      if (!window.LegacyLoaders) {
        warn('LegacyLoaders 未加载，_legacyLoadMessages 跳过');
        return;
      }
      try { if (this.mm._legacyUsage) this.mm._legacyUsage.loadMessages++; } catch(_){ }
      return window.LegacyLoaders.loadMessages({ conversationId, messageModule: this.mm });
    }

    /**
     * @deprecated 原有发送消息逻辑（降级使用）
     */
    sendMessage(content) {
      warn('_legacySendMessage 已废弃，请使用 MessageSender.enqueueText');
      if (!window.LegacySenders) {
        warn('LegacySenders 未加载，_legacySendMessage 跳过');
        return;
      }
      try { if (this.mm._legacyUsage) this.mm._legacyUsage.sendMessage++; } catch(_){ }
      window.LegacySenders.sendMessage({ messageModule: this.mm, content });
    }

    /**
     * @deprecated 原有店铺显示逻辑（降级使用）
     */
    async showShops() {
      warn('_legacyShowShops 已废弃，请使用 shopsManager.loadAndShowShops');
      if (!window.LegacyLoaders) {
        warn('LegacyLoaders 未加载，_legacyShowShops 跳过');
        return;
      }
      try { if (this.mm._legacyUsage) this.mm._legacyUsage.showShops++; } catch(_){ }
      return window.LegacyLoaders.showShops({ messageModule: this.mm });
    }

    /**
     * @deprecated 原有对话加载逻辑（降级使用）
     */
    async loadConversationsForShop(shopId) {
      warn('_legacyLoadConversationsForShop 已废弃，请使用 conversationsManager.loadConversationsForShop');
      if (!window.LegacyLoaders) {
        warn('LegacyLoaders 未加载，_legacyLoadConversationsForShop 跳过');
        return;
      }
      try { if (this.mm._legacyUsage) this.mm._legacyUsage.loadConversationsForShop++; } catch(_){ }
      return window.LegacyLoaders.loadConversationsForShop({ shopId, messageModule: this.mm });
    }

    /**
     * @deprecated handleWebSocketMessage 旧内联处理逻辑 (保留回退)
     * 拆分后请使用独立模块 message-ws-events-handler.js
     */
    handleWebSocketMessage(data) {
      warn('handleWebSocketMessage (inline) 已废弃，请确保 WsEventRouter 正常工作');
      if (!data || !data.type) return;
      
      try { if (window.__WsEventsMetrics && window.__WsEventsMetrics.record){ window.__WsEventsMetrics.record(data, { path: 'inline-legacy' }); } } catch(_){ }
      // 统计 inline handler 仍被触发频率
      try { if (this.mm._legacyUsage) this.mm._legacyUsage.wsInlineHandler++; } catch(_){ }
      
      const t = data.type;
      if (t === 'message' || data.msg_type === 'message') return this.handleLegacyNewMessage(data);
      if (t === 'typing') return (this.mm.handleTypingIndicator && this.mm.handleTypingIndicator(data));
      if (t === 'conversation_update') {
        if (this.mm.currentShopId && this.mm.conversationsManager) this.mm.conversationsManager.loadConversationsForShop(this.mm.currentShopId);
        return;
      }
      if (t && t.startsWith('domain.event.')) {
        if (t.endsWith('message_appended')) return this.mm.handleDomainMessageAppended((data.data && data.data.message)||data.data||data);
        if (t.endsWith('message_updated')) return this.mm.handleDomainMessageUpdated((data.data && data.data.message)||data.data||data);
        if (t.endsWith('message_deleted')) return this.mm.handleDomainMessageDeleted((data.data && data.data.message)||data.data||data);
      }
    }

    /**
     * 兼容处理新消息（降级使用）
     */
    handleLegacyNewMessage(messageData) {
      if (this.mm.currentConversationId && 
          String(messageData.conversation_id) === String(this.mm.currentConversationId)) {
        // 尝试 ACK 替换 (legacy path)
        try {
          if (this.mm._sender && messageData.temp_id) {
            const replaced = this.mm._sender.handleServerMessage(messageData);
            if (replaced) return; // 已替换并触发更新
          }
        } catch(e){ warn('ACK 替换失败 (legacy new)', e); }
        
        const exists = this.mm.messages.some(m => {
          if (messageData.id && m.id) return String(m.id) === String(messageData.id);
          const sameSender = m.sender_type === messageData.sender_type;
          const sameContent = (m.content || '').trim() === (messageData.content || '').trim();
          const t1 = m.timestamp || m.sent_at || m.created_at;
          const t2 = messageData.timestamp || messageData.sent_at || messageData.created_at;
          const sameTime = t1 && t2 && String(t1) === String(t2);
          return sameSender && sameContent && sameTime;
        });
        
        if (!exists) {
          this.mm.messages.push(messageData);
          this.mm.renderMessage(messageData);
          this.mm._notifyNewMessageForScroll();
        }
      }
      
      this.mm.updateConversationPreview(messageData);
    }

    /**
     * @deprecated WebSocket 初始化（已被 MessageWSHandler 替代）
     */
    initWebSocket(){
      warn('_legacyInitWebSocket 已废弃，调用被忽略');
    }

    /**
     * 获取使用统计
     */
    getUsageStats() {
      return this.mm._legacyUsage ? { ...this.mm._legacyUsage } : {};
    }

    /**
     * 判断是否可以安全下线某个方法
     */
    canSafelyRemove(methodName, thresholdDays = 3) {
      const usage = this.getUsageStats();
      if (!usage[methodName]) return true;
      
      // 如果有重置时间戳，检查时间窗口内的使用情况
      if (usage.lastResetAt) {
        const daysSinceReset = (Date.now() - usage.lastResetAt) / (1000 * 60 * 60 * 24);
        return daysSinceReset >= thresholdDays && usage[methodName] === 0;
      }
      
      return usage[methodName] === 0;
    }

    /**
     * 生成下线建议报告
     */
    generateRemovalReport() {
      const methods = ['loadMessages', 'sendMessage', 'showShops', 'loadConversationsForShop', 'wsInlineHandler'];
      const report = {
        canRemove: [],
        stillInUse: [],
        recommendations: []
      };

      methods.forEach(method => {
        if (this.canSafelyRemove(method)) {
          report.canRemove.push(method);
        } else {
          report.stillInUse.push({ method, usage: this.getUsageStats()[method] || 0 });
        }
      });

      if (report.canRemove.length > 0) {
        report.recommendations.push(`可安全移除: ${report.canRemove.join(', ')}`);
      }
      if (report.stillInUse.length > 0) {
        report.recommendations.push(`仍在使用: ${report.stillInUse.map(s => `${s.method}(${s.usage}次)`).join(', ')}`);
      }

      return report;
    }
  }

  // 工厂方法
  function create(messageModuleInstance) {
    return new MessageLegacyCompat(messageModuleInstance);
  }

  // 暴露接口
  window.MessageLegacyCompat = { create, MessageLegacyCompat };

  // 自动注册到现有的 MessageModule 实例（如果存在）
  if (window.MessageModuleInstance && !window.MessageModuleInstance._legacyCompat) {
    window.MessageModuleInstance._legacyCompat = create(window.MessageModuleInstance);
  }

})();