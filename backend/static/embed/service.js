/* QuickTalk 兼容层：提供 window.QuickTalkCustomerService.init({ shopId, serverUrl }) */
(function(){
  function onReady(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }
  function loadScript(src) {
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src;
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('Failed to load: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureSDK(serverUrl) {
    if (window.CustomerServiceSDK) return Promise.resolve();
    var url = (serverUrl || '').replace(/\/$/, '') + '/static/sdk/index.js';
    return loadScript(url);
  }

  function createUI() {
    if (document.getElementById('qt-fab')) {
      return {
        btn: document.getElementById('qt-fab'),
        panel: document.getElementById('qt-panel')
      };
    }
    var btn = document.createElement('div');
    btn.id = 'qt-fab';
    btn.className = 'qt-fab';
    btn.textContent = '客服';
    // 兜底内联样式（若外部 CSS 未加载，仍可见）
    btn.style.position = 'fixed';
    btn.style.right = '18px';
    btn.style.bottom = '18px';
    btn.style.background = '#07C160';
    btn.style.color = '#fff';
    btn.style.borderRadius = '999px';
    btn.style.padding = '12px 16px';
    btn.style.boxShadow = '0 10px 25px -12px rgba(7,193,96,.6)';
    btn.style.cursor = 'pointer';
    btn.style.userSelect = 'none';
    btn.style.font = '600 14px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
    btn.style.zIndex = '2147483647';

    var panel = document.createElement('div');
    panel.id = 'qt-panel';
    panel.className = 'qt-panel';
    // 兜底内联样式
    panel.style.position = 'fixed';
    panel.style.right = '18px';
    panel.style.bottom = '68px';
    panel.style.width = '320px';
    panel.style.height = '440px';
    panel.style.background = '#fff';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 16px 48px -12px rgba(15,23,42,.35)';
    panel.style.display = 'none';
    panel.style.flexDirection = 'column';
    panel.style.overflow = 'hidden';
    panel.style.zIndex = '2147483647';
    panel.innerHTML = '<div class="qt-header" style="padding:12px 14px;border-bottom:1px solid #eee;font-weight:700;background:#f9fafb">在线客服</div><div class="qt-body" style="flex:1;padding:10px 12px;overflow:auto;background:#fafafa"></div><div class="qt-input" style="display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff"><input type="text" placeholder="输入消息..." style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px"/><button style="padding:8px 12px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer">发送</button></div>';
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    return { btn: btn, panel: panel };
  }

  function wireUI(sdk, ui) {
    var open = false;
    var input = ui.panel.querySelector('input');
    var send = ui.panel.querySelector('button');
    var body = ui.panel.querySelector('.qt-body');
    function toggle(){
      open = !open;
      ui.panel.style.display = open ? 'flex' : 'none';
    }
    ui.btn.addEventListener('click', toggle);
    send.addEventListener('click', function(){
      var txt = (input.value || '').trim();
      if (!txt) return;
      try { sdk.sendMessage(txt, 'text'); } catch(e) { console.error(e); }
      addMsg(txt, true);
      input.value = '';
    });
    function addMsg(text, own){
      var item = document.createElement('div');
      item.className = 'qt-msg' + (own ? ' own' : '');
      item.textContent = text;
      body.appendChild(item);
      body.scrollTop = body.scrollHeight;
    }
    sdk.on('message', function(m){ if (m && m.content) addMsg(m.content, m.senderType === 'customer'); });
  }

  window.QuickTalkCustomerService = {
    init: function(opts){
      var serverUrl = (opts && opts.serverUrl) || (location.protocol + '//' + location.host);
      var shopRef = opts && opts.shopId;
      if (!shopRef) { console.error('QuickTalk init: shopId 必填'); return; }
      ensureSDK(serverUrl).then(function(){
        onReady(function(){
          var sdk = new window.CustomerServiceSDK({
            serverUrl: serverUrl,
            apiKey: String(shopRef),
            customerId: 'guest-' + Math.random().toString(36).slice(2),
            reconnectInterval: 5000,
            maxReconnectAttempts: 5
          });
          var ui = createUI();
          wireUI(sdk, ui);
          sdk.connect();
          console.log('QuickTalk shim initialized');
        });
      }).catch(function(e){
        console.error('QuickTalk SDK 加载失败', e);
      });
    }
  };
})();
