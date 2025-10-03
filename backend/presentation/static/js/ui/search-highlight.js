(function(){
  'use strict';

  var HIGHLIGHT_CLASS = 'qt-highlight';

  function clearHighlights(root){
    (root||document).querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(function(span){
      var parent = span.parentNode; if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize && parent.normalize();
    });
  }

  function highlight(element, term){
    if (!element || !term) return;
    var text = element.textContent; if (!text) return;
    var idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return;
    var before = document.createTextNode(text.slice(0, idx));
    var mark = document.createElement('span');
    mark.className = HIGHLIGHT_CLASS; mark.textContent = text.slice(idx, idx + term.length);
    var after = document.createTextNode(text.slice(idx + term.length));
    element.textContent = '';
    element.appendChild(before); element.appendChild(mark); element.appendChild(after);
  }

  function apply(term){
    try {
      clearHighlights(document);
      if (!term) return;
      document.querySelectorAll('.conversation-item .customer-name, .conversation-item .last-message').forEach(function(el){
        highlight(el, term);
      });
    } catch(e) { /* noop */ }
  }

  // 简单样式注入（若无则插入）
  function injectStyle(){
    if (document.getElementById('qt-highlight-style')) return;
    var style = document.createElement('style');
    style.id = 'qt-highlight-style';
    style.textContent = '.'+HIGHLIGHT_CLASS+'{ background: linear-gradient(transparent 60%, rgba(255,235,59,.8) 60%); }';
    document.head.appendChild(style);
  }

  function init(){ injectStyle(); }

  window.SearchHighlightUI = { init: init, apply: apply, clear: function(){ clearHighlights(document); } };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
