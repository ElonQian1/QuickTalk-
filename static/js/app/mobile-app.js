// Entry assembly for mobile chat (incremental migration)
(function(global){
  const QT = global.QuickTalk = global.QuickTalk || {};
  function MobileApp(){
    this.wsClient = null;
    this.handlers = [];
  }
  MobileApp.prototype.init = function(){
     // 确保 State / Templates 已经被附加（容错加载顺序）
     if(!QT.State){ console.warn('[MobileApp] QT.State not loaded yet - state-driven rendering will be deferred.'); }
     if(!QT.Templates){ console.warn('[MobileApp] QT.Templates not loaded yet - UI template rendering deferred.'); }
    const sessionId = localStorage.getItem('sessionId');
    const self=this;
    this.wsClient = QT.WS.createWebSocket({
      onOpen(){ if(sessionId){ self.wsClient.send({ type:'auth', sessionId }); } },
      onMessage(data){ const evt = QT.Protocol.adapt(data); if(evt){ self.dispatch(evt); } }
    });
  };
  MobileApp.prototype.on = function(kind, handler){ this.handlers.push({kind, handler}); };
  MobileApp.prototype.dispatch = function(evt){ this.handlers.filter(h=>h.kind===evt.kind).forEach(h=>h.handler(evt.payload)); };
  QT.MobileApp = MobileApp;
})(window);
