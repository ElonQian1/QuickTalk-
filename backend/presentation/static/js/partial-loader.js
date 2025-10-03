// 兼容旧路径：转发到 utils/partials-loader.js
(function(){
  if (window.__PartialsLoaderLoaded) return;
  if (document.querySelector('script[src="/static/js/utils/partials-loader.js"]')) return;
  if (!window.__PartialLoaderAliasInjected) {
    window.__PartialLoaderAliasInjected = true;
    var s = document.createElement('script');
    s.src = '/static/js/utils/partials-loader.js';
    document.head.appendChild(s);
  }
})();