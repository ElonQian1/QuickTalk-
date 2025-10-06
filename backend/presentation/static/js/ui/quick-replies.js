/**
 * QuickReplies UI 组件：构建快捷回复按钮区（继承UIBase）
 * 已重构：使用UIBase统一DOM操作
 */
(function(){
  'use strict';

  class QuickReplies extends UIBase {
    constructor(options = {}) {
      super('QuickReplies', {
        debug: false,
        ...options
      });

      this.DEFAULTS = [
        '您好～', '在的，请稍等', '请问还有其他问题吗？', '收到，我们尽快处理', '感谢反馈！'
      ];

      this.log('info', 'QuickReplies组件初始化完成');
    }

    buildItem(text, onClick) {
      const btn = this.createElement('button', {
        className: 'quick-reply-btn',
        attributes: { type: 'button' },
        textContent: text
      });
      
      btn.addEventListener('click', () => onClick && onClick(text));
      return btn;
    }

    build(container, phrases, onClick) {
      const root = container || document.querySelector('.quick-replies');
      if (!root) return null;
      
      const list = Array.isArray(phrases) && phrases.length ? phrases : this.DEFAULTS;
      root.innerHTML = '';
      list.forEach(ph => root.appendChild(this.buildItem(ph, onClick)));
      
      this.log('debug', `构建快捷回复: ${list.length}个按钮`);
      return root;
    }
  }

  // 创建全局实例
  const quickReplies = new QuickReplies();

  // 向下兼容的方法
  function buildItem(text, onClick) {
    return quickReplies.buildItem(text, onClick);
  }

  function build(container, phrases, onClick) {
    return quickReplies.build(container, phrases, onClick);
  }

  let __inited = false;
  function init(opts) {
    if (__inited) return;
    const root = document.querySelector('.quick-replies');
    if (!root) return;
    const onClick = (txt) => {
      const input = document.getElementById('chatInput') || 
                   document.getElementById('messageInput') || 
                   document.querySelector('[data-role="message-input"]');
      if (input) { 
        input.value = (input.value ? input.value + ' ' : '') + txt; 
        input.focus(); 
      }
    };
    build(root, opts && opts.phrases, opts && opts.onClick || onClick);
    __inited = true;
  }

  // 暴露接口
  window.QuickReplies = QuickReplies;
  window.quickReplies = quickReplies;
  window.QuickRepliesUI = { build, init, buildItem };

  console.log('✅ QuickReplies组件已重构为UIBase继承版本');
})();
