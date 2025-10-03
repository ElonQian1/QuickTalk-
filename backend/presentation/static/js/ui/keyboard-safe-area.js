/*
 * UI: 键盘安全区适配 (keyboard-safe-area.js)
 * - 移动端软键盘弹出时，动态为 #chatMessages 添加 padding-bottom
 * - 提供 apply(height) 和 reset() 接口
 */
(function(){
  'use strict';

  var STYLE_ID = 'qt-keyboard-safe-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#chatMessages.keyboard-active{transition:padding-bottom .2s ease;}',
      '.bottom-nav.keyboard-active{transition:transform .2s ease;}'
    ].join('');
    document.head.appendChild(style);
  }

  function apply(keyboardHeight){
    injectStyle();
    var list = document.getElementById('chatMessages');
    if (!list) return;
    var safeHeight = Math.max(0, keyboardHeight || 0);
    list.classList.add('keyboard-active');
    list.style.paddingBottom = safeHeight + 'px';
    // 可选：隐藏底部导航避免被遮挡
    var nav = document.querySelector('.bottom-nav');
    if (nav && safeHeight > 0) {
      nav.classList.add('keyboard-active');
      nav.style.transform = 'translateY(' + safeHeight + 'px)';
    }
  }

  function reset(){
    var list = document.getElementById('chatMessages');
    if (list) {
      list.classList.remove('keyboard-active');
      list.style.paddingBottom = '';
    }
    var nav = document.querySelector('.bottom-nav');
    if (nav) {
      nav.classList.remove('keyboard-active');
      nav.style.transform = '';
    }
  }

  window.KeyboardSafeUI = { apply: apply, reset: reset };
  console.log('✅ keyboard-safe-area UI 已加载');
})();
