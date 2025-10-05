(function(){
  'use strict';
  var LONG_PRESS_MS = 420;
  var inited = false;
  var timer = null;
  var pressTarget = null;

  function findMessageText(el){
    var bubble = el.closest('.message-bubble');
    if (!bubble) return '';
    // 文本内容优先
    var text = bubble.textContent || '';
    return (text || '').trim();
  }

  function showMenu(e){
    if (!pressTarget) return;
    var x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) || 0;
    var y = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY) || 0;
    if (window.MessageActionsUI && typeof window.MessageActionsUI.show==='function'){
      window.MessageActionsUI.show(x, y, {
        onSelect: function(key){
          if (key === 'copy'){
            var txt = findMessageText(pressTarget);
            if (txt){
              // 使用统一剪贴板工具
              if (window.UnifiedClipboard) {
                window.UnifiedClipboard.copyText(txt, {
                  successMessage: '✅ 消息已复制',
                  errorMessage: (window.StateTexts && window.StateTexts.ACTION_COPY_FAIL) || '❌ 复制失败'
                });
              } else {
                // 降级兼容实现
                navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : null;
                if (window.showToast) window.showToast('已复制');
              }
            }
          } else if (key === 'delete'){
            if (window.showToast) window.showToast('删除功能待实现');
          } else if (key === 'forward'){
            if (window.showToast) window.showToast('转发功能待实现');
          }
        }
      });
    }
  }

  function clearPress(){ if (timer){ clearTimeout(timer); timer = null; } }

  function onDown(e){
    var t = e.target;
    var bubble = t.closest('.message-bubble');
    if (!bubble) return;
    pressTarget = bubble;
    clearPress();
    timer = setTimeout(function(){ showMenu(e); }, LONG_PRESS_MS);
  }

  function onUp(){ clearPress(); pressTarget = null; }
  function onMove(){ clearPress(); }

  function bind(){
    var list = document.getElementById('chatMessages');
    if (!list) { setTimeout(bind, 200); return; }
    if (inited) return; inited = true;
    if (window.MessageActionsUI && typeof window.MessageActionsUI.ensure==='function') window.MessageActionsUI.ensure();
    list.addEventListener('touchstart', onDown, { passive: true });
    list.addEventListener('mousedown', onDown);
    list.addEventListener('touchend', onUp, { passive: true });
    list.addEventListener('mouseup', onUp);
    list.addEventListener('touchmove', onMove, { passive: true });
    list.addEventListener('mousemove', onMove);
    console.log('✅ message-actions 用例已初始化');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else { bind(); }
})();
