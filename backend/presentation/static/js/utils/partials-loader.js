/*
 * PartialsLoader — 按需加载页面片段
 * 用法：在 DOMContentLoaded 或任意时机调用 PartialsLoader.loadPartials()
 * 支持属性：data-include="/static/components/xxx.html"
 */
(function(){
  'use strict';

  // 幂等保护：避免被重复加载
  if (window.__PartialsLoaderLoaded) {
    console.log('ℹ️ partials-loader 已加载，跳过重复初始化');
    return;
  }
  window.__PartialsLoaderLoaded = true;

  // 全局脚本加载去重集合
  window.__LoadedScriptSrcSet = window.__LoadedScriptSrcSet || new Set();

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
        // 若该 src 已加载过，则跳过，避免重复执行
        const src = old.src.split('?')[0];
        if (window.__LoadedScriptSrcSet.has(src) || document.querySelector(`script[src="${src}"]`)) {
          return;
        }
        s.src = src;
        window.__LoadedScriptSrcSet.add(src);
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
    // 迭代式加载，直到没有新的 data-include 未处理项（支持嵌套片段）
    while (true) {
      const nodes = Array
        .from(scope.querySelectorAll('[data-include]'))
        .filter(el => !el.__included);
      if (!nodes.length) break;
      for (const el of nodes){
        await loadOne(el);
      }
    }
  }

  window.PartialsLoader = { loadPartials };

  console.log('✅ partials-loader.js 已加载');
})();
