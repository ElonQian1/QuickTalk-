/* QuickReplies UI 组件：构建快捷回复按钮区 */
(function(){
  'use strict';

  const DEFAULTS = [
    '您好～', '在的，请稍等', '请问还有其他问题吗？', '收到，我们尽快处理', '感谢反馈！'
  ];

  function buildItem(text, onClick){
    const btn = document.createElement('button');
    btn.className = 'quick-reply-btn';
    btn.type = 'button';
    btn.textContent = text;
    btn.addEventListener('click', () => onClick && onClick(text));
    return btn;
  }

  function build(container, phrases, onClick){
    const root = container || document.querySelector('.quick-replies');
    if (!root) return null;
    const list = Array.isArray(phrases) && phrases.length ? phrases : DEFAULTS;
    root.innerHTML = '';
    list.forEach(ph => root.appendChild(buildItem(ph, onClick)));
    return root;
  }

  let __inited = false;
  function init(opts){
    if (__inited) return;
    const root = document.querySelector('.quick-replies');
    if (!root) return;
    const onClick = (txt)=>{
      const input = document.getElementById('chatInput') || document.getElementById('messageInput') || document.querySelector('[data-role="message-input"]');
      if (input){ input.value = (input.value ? input.value + ' ' : '') + txt; input.focus(); }
    };
    build(root, opts && opts.phrases, opts && opts.onClick || onClick);
    __inited = true;
  }

  window.QuickRepliesUI = { build, init };
})();
