(function(){
  'use strict';
  if (window.MessageViewController) return;
  /**
   * MessageViewController
   * 负责: 导航标题更新 / 视图切换 / 返回逻辑
   * 与业务数据解耦, 仅操作 DOM + 调用回调。
   */
  class MessageViewController {
    constructor(opts){ this._o = Object.assign({ debug:false }, opts||{}); }
    updateNavigationUI(title, showBackBtn){
      const backBtn = document.getElementById('messagesBackBtn');
      const titleElement = document.getElementById('messagesTitle');
      if (titleElement) titleElement.textContent = title || '';
      if (backBtn){
        if (showBackBtn){ backBtn.textContent='←'; backBtn.style.display='inline-block'; }
        else backBtn.style.display='none';
        if (!backBtn._bound){
          backBtn.addEventListener('click', ()=> { this._o.onBack && this._o.onBack(); });
          backBtn._bound = true;
        }
      }
    }
    showView(viewId){
      if (window.MessagesViews && typeof window.MessagesViews.show==='function'){
        return window.MessagesViews.show(viewId);
      }
      const views = ['shopsListView','conversationsListView','chatView'];
      const bottomNav = document.querySelector('.bottom-nav');
      views.forEach(id=>{ const el = document.getElementById(id); if (el) el.style.display = id===viewId? 'block':'none'; });
      if (bottomNav){
        if (viewId==='chatView') bottomNav.classList.add('hidden'); else bottomNav.classList.remove('hidden');
      }
    }
    goBack(current){
      // current: { inChat, inConversations }
      if (current.inChat){
        this.showView('conversationsListView');
        this.updateNavigationUI('客户对话', true);
      } else if (current.inConversations){
        this.showView('shopsListView');
        this.updateNavigationUI('客服消息', false);
        this._o.onLeaveShop && this._o.onLeaveShop();
      }
    }
  }
  window.MessageViewController = { create: (o)=> new MessageViewController(o) };
  console.log('✅ message-view-controller.js 已加载');
})();
