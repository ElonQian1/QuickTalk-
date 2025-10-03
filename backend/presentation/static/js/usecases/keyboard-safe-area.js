/*
 * 键盘安全区适配用例 (keyboard-safe-area.js)
 * - 监听聊天输入框 focus/blur 与 resize 事件
 * - focus 时记录窗口高度变化推算键盘高度；blur 时重置
 */
(function(){
  'use strict';

  var inited = false;
  var initialHeight = window.innerHeight;

  function onResize(){
    var currentHeight = window.innerHeight;
    var diff = initialHeight - currentHeight;
    if (diff > 100 && window.KeyboardSafeUI && typeof window.KeyboardSafeUI.apply === 'function') {
      window.KeyboardSafeUI.apply(diff);
    } else if (diff <= 0 && window.KeyboardSafeUI && typeof window.KeyboardSafeUI.reset === 'function') {
      window.KeyboardSafeUI.reset();
    }
  }

  function onFocus(){
    initialHeight = window.innerHeight;
    window.addEventListener('resize', onResize);
  }

  function onBlur(){
    window.removeEventListener('resize', onResize);
    if (window.KeyboardSafeUI && typeof window.KeyboardSafeUI.reset === 'function') {
      window.KeyboardSafeUI.reset();
    }
  }

  function bind(){
    var input = document.getElementById('chatInput') || document.getElementById('messageInput');
    if (!input) {
      setTimeout(bind, 200);
      return;
    }
    if (inited) return;
    inited = true;
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    console.log('✅ keyboard-safe-area 用例已初始化');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else { bind(); }
})();
