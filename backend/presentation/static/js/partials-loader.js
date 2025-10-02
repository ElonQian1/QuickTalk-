// Lightweight HTML partials loader
// Usage: add placeholders like <div data-include="/static/components/top-bar.html"></div>
// Then call window.loadPartials(). Returns a Promise that resolves when all partials are loaded.
(function(){
  async function fetchText(url){
    const res = await fetch(url, { credentials: 'same-origin' });
    if(!res.ok){ throw new Error(`Failed to load partial: ${url} (${res.status})`); }
    return await res.text();
  }

  async function loadPartials(root=document){
    // 递归解析，处理嵌套 include，最多 5 层防止循环包含
    const MAX_DEPTH = 5;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const nodes = Array.from(root.querySelectorAll('[data-include]'));
      if (nodes.length === 0) break;
      for (const el of nodes) {
        const url = el.getAttribute('data-include');
        try {
          const html = await fetchText(url);
          el.outerHTML = html;
        } catch (err) {
          console.error('[partials-loader] load failed:', url, err);
        }
      }
    }
  }

  window.PartialsLoader = { loadPartials };
})();
