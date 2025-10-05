(function(){
  'use strict';
  if (window.MessageNavigation) return; // 幂等

  /**
   * MessageNavigation
   * 负责：导航标题/返回按钮状态、视图显示/隐藏、聊天头部更新
   * 设计：与 MessageModule 解耦，仅通过注入的 messageModule( mm ) 访问必要数据
   * 不负责：数据加载、状态写入、业务事件发布
   */
  class MessageNavigation {
    constructor(mm){
      this.mm = mm;
      this._view = null; // MessageViewController 实例
    }

    /** 外部统一调用入口 */
    updateNavigationUI(title, showBackBtn){
      this._ensureViewController();
      if (this._view && this._view.updateNavigationUI){
        this._view.updateNavigationUI(title, !!showBackBtn);
      }
    }

    showView(viewId){
      this._ensureViewController();
      if (this._view && this._view.showView){
        this._view.showView(viewId);
      } else {
        // 回退：直接展示对应容器
        const el = document.getElementById(viewId);
        if (el) el.style.display='block';
      }
    }

    goBack(){
      this._ensureViewController();
      if (!this._view || !this._view.goBack) return;
      const chatView = document.getElementById('chatView');
      const convView = document.getElementById('conversationsListView');
      this._view.goBack({
        inChat: !!(chatView && chatView.style.display==='block'),
        inConversations: !!(convView && convView.style.display==='block')
      });
    }

    updateChatHeader(conversation, customer){
      // 复用旧逻辑
      if (window.ChatHeaderUI && typeof window.ChatHeaderUI.updateForConversation === 'function') {
        try { window.ChatHeaderUI.updateForConversation(conversation, { customerName: customer.name }); return; } catch(_){ }
      }
      const titleElement = document.getElementById('messagesTitle');
      if (titleElement) titleElement.textContent = customer.name;
    }

    // 内部：确保视图控制器
    _ensureViewController(){
      if (this._view || !window.MessageViewController) return;
      try {
        this._view = window.MessageViewController.create({
          onBack: ()=> this.goBack(),
          onLeaveShop: ()=> { if (this.mm) this.mm.currentShopId = null; }
        });
      } catch(e){ /* 静默 */ }
    }
  }

  window.MessageNavigation = {
    create(mm){ return new MessageNavigation(mm); }
  };
  console.log('✅ message-navigation.js 已加载');
})();
