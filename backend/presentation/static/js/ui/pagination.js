(function(){
  'use strict';

  var STYLE_ID = 'qt-pagination-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.qt-pagination{display:flex;align-items:center;justify-content:center;gap:12px;margin:12px 0;}',
      '.qt-page-info{font-size:12px;color:#6c757d;}',
      '.qt-load-more{padding:8px 16px;border:1px solid #e9ecef;border-radius:16px;background:#fff;cursor:pointer;font-size:13px;}',
      '.qt-load-more:hover{border-color:#667eea;color:#667eea;background:#f8f9ff;}',
      '.qt-load-more:disabled{opacity:.6;cursor:not-allowed;}'
    ].join('');
    document.head.appendChild(style);
  }

  function createBar(opts){
    injectStyle();
    var total = opts && opts.total || 0;
    var shown = opts && opts.shown || 0;
    var onLoadMore = opts && opts.onLoadMore || function(){};

    var bar = document.createElement('div');
    bar.className = 'qt-pagination';
    var info = document.createElement('span');
    info.className = 'qt-page-info';
    var btn = document.createElement('button');
    btn.className = 'qt-load-more';
    btn.textContent = '加载更多';
    btn.addEventListener('click', function(){ onLoadMore(); });

    function render(){
      info.textContent = '已显示 ' + Math.min(shown, total) + ' / ' + total;
      btn.disabled = shown >= total;
      btn.style.display = total > shown ? 'inline-block' : 'none';
    }
    bar.__update = function(next){
      if (!next) next = {}; if (typeof next.total === 'number') total = next.total; if (typeof next.shown === 'number') shown = next.shown; render();
    };
    render();
    bar.appendChild(info); bar.appendChild(btn);
    return bar;
  }

  window.PaginationUI = {
    createBar: createBar
  };

  console.log('✅ Pagination UI 已加载');
})();
