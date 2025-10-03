/*
 * UI: 底部导航控制 (bottom-nav.js)
 * - 提供 show/hide/toggle 接口
 * - 注入样式与动画
 */
(function(){
  'use strict';

  var STYLE_ID = 'qt-bottom-nav-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.bottom-nav.qt-hidden{transform:translateY(100%);pointer-events:none;}',
      '.bottom-nav.qt-visible{transform:translateY(0);pointer-events:auto;}',
      '.bottom-nav{transition:transform .25s ease-out;}'
    ].join('');
    document.head.appendChild(style);
  }

  function getNav(){
    return document.querySelector('.bottom-nav');
  }

  function show(){
    injectStyle();
    var nav = getNav();
    if (!nav) return;
    nav.classList.remove('qt-hidden');
    nav.classList.add('qt-visible');
    nav.style.transform = 'translateY(0)';
  }

  function hide(){
    injectStyle();
    var nav = getNav();
    if (!nav) return;
    nav.classList.add('qt-hidden');
    nav.classList.remove('qt-visible');
    nav.style.transform = 'translateY(100%)';
  }

  function toggle(visible){
    if (visible === undefined) {
      var nav = getNav();
      visible = nav && nav.classList.contains('qt-hidden');
    }
    visible ? show() : hide();
  }

  window.BottomNavUI = { show: show, hide: hide, toggle: toggle };
  console.log('✅ bottom-nav UI 已加载');
})();
