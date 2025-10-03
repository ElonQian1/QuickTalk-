/* Chat Composer 用例：统一绑定输入、发送、粘贴、快捷回复、工具栏 */
(function(){
  'use strict';

  function getInput(){
    return document.getElementById('chatInput') || document.getElementById('messageInput') || document.querySelector('[data-role="message-input"]');
  }

  function sendText(content){
    if (!content) return;
    // 优先 messageModule
    if (window.messageModule && typeof window.messageModule.sendMessage === 'function') {
      const input = getInput();
      if (input) input.value = '';
      return window.messageModule.sendMessage(); // 其内部取值并发送
    }
    // 其次全局 sendMessage(content)
    if (typeof window.sendMessage === 'function') return window.sendMessage(content);
    console.warn('未找到发送实现: messageModule.sendMessage 或 window.sendMessage');
  }

  function bindKeyboard(input){
    function onKeydown(e){
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = input.value.trim();
        if (!content) return;
        sendText(content);
      }
    }
    input.addEventListener('keydown', onKeydown);
  }

  function bindPaste(input){
    input.addEventListener('paste', (e) => {
      try {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items || !items.length) return;
        for (const it of items) {
          if (it.type && it.type.startsWith('image/')) {
            if (window.showToast) window.showToast('粘贴图片暂未直传，建议使用附件按钮', 'info');
            break;
          }
        }
      } catch(err){ console.warn('composer paste error:', err); }
    });
  }

  function initQuickReplies(){
    if (window.QuickRepliesUI && typeof window.QuickRepliesUI.init === 'function') {
      window.QuickRepliesUI.init();
    }
  }

  function initToolbar(){
    if (window.ComposerToolbarUI && typeof window.ComposerToolbarUI.init === 'function') {
      window.ComposerToolbarUI.init({
        onMedia(fileInput){ if (fileInput) fileInput.click(); },
        onVoice(){ if (window.messageModule && window.messageModule.toggleVoiceRecording) window.messageModule.toggleVoiceRecording(); }
      });
    }
  }

  let __inited = false;
  function init(){
    if (__inited) return;
    const input = getInput();
    if (!input) { console.log('chat-composer: 找不到输入框，跳过'); return; }
    bindKeyboard(input);
    bindPaste(input);
    initQuickReplies();
    initToolbar();
    __inited = true;
    console.log('✅ Chat Composer 就绪 (chat-composer.js)');
  }

  window.ChatComposer = { init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
