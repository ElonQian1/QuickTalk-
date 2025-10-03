/*
 * PartialsLoader — 按需加载页面片段
 * 用法：在 DOMContentLoaded 或任意时机调用 PartialsLoader.loadPartials()
 * 支持属性：data-include="/static/components/xxx.html"
 */
(function(){
  'use strict';

  async function fetchText(url){
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Fetch partial failed: ' + res.status);
    return res.text();
  }

  function executeScripts(container){
    // 执行片段中携带的 <script> 标签（保持与普通静态加载一致）
    const scripts = container.querySelectorAll('script');
    scripts.forEach(old => {
      const s = document.createElement('script');
      if (old.src) {
        s.src = old.src;
      } else {
        s.textContent = old.textContent;
      }
      // 复制必要属性
      ['type','async','defer','crossorigin','referrerpolicy'].forEach(k => {
        if (old.hasAttribute(k)) s.setAttribute(k, old.getAttribute(k));
      });
      old.parentNode.replaceChild(s, old);
    });
  }

  async function loadOne(el){
    const url = el.getAttribute('data-include');
    if (!url) return;
    if (el.__included) return; // 幂等保护
    try {
      const html = await fetchText(url);
      el.innerHTML = html;
      el.__included = true;
      executeScripts(el);
    } catch (e){
      console.warn('Partial include failed:', url, e);
    }
  }

  async function loadPartials(root){
    const scope = root || document;
    const nodes = Array.from(scope.querySelectorAll('[data-include]'));
    for (const el of nodes){
      await loadOne(el);
    }
  }

  window.PartialsLoader = { loadPartials };

  console.log('✅ partials-loader.js 已加载');
})();
