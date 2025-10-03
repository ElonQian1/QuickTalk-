/* Chat Composer 用例：统一绑定输入、发送、粘贴、快捷回复、工具栏 */
(function(){
  'use strict';

  function getInput(){
    return document.getElementById('chatInput') || document.getElementById('messageInput') || document.querySelector('[data-role="message-input"]');
  }

  function getSendBtn(){
    return document.getElementById('sendBtn') || document.querySelector('[data-role="send-button"]');
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

  function bindSendButton(btn, input){
    if (!btn) return;
    btn.addEventListener('click', () => {
      const content = (input?.value || '').trim();
      if (!content) return;
      sendText(content);
    });
  }

  function bindInputListener(input, btn){
    if (!input || !btn) return;
    // 初始状态根据输入框内容判断
    const updateButtonState = () => {
      const hasContent = (input.value || '').trim().length > 0;
      if (hasContent) {
        btn.removeAttribute('disabled');
        btn.classList.remove('disabled');
      } else {
        btn.setAttribute('disabled', 'disabled');
        btn.classList.add('disabled');
      }
    };
    input.addEventListener('input', updateButtonState);
    input.addEventListener('change', updateButtonState);
    // 首次检查
    updateButtonState();
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

  function toggleQuickReplies(){
    const container = document.getElementById('quickReplies') || document.querySelector('.quick-replies');
    if (!container) return;
    container.classList.toggle('show');
  }

  function initToolbar(){
    if (window.ComposerToolbarUI && typeof window.ComposerToolbarUI.init === 'function') {
      window.ComposerToolbarUI.init({
        onMedia(fileInput){ if (fileInput) fileInput.click(); },
        onVoice(){ if (window.messageModule && window.messageModule.toggleVoiceRecording) window.messageModule.toggleVoiceRecording(); }
      });
    }
    // 绑定快捷回复按钮
    const quickReplyBtn = document.getElementById('quickReplyBtn');
    if (quickReplyBtn) {
      quickReplyBtn.addEventListener('click', toggleQuickReplies);
    }
  }

  let __inited = false;
  function init(){
    if (__inited) return;
    const input = getInput();
    if (!input) { console.log('chat-composer: 找不到输入框，跳过'); return; }
    const sendBtn = getSendBtn();
    bindKeyboard(input);
    bindPaste(input);
    bindSendButton(sendBtn, input);
    bindInputListener(input, sendBtn);
    initQuickReplies();
    initToolbar();
    __inited = true;
    console.log('✅ Chat Composer 就绪 (chat-composer.js)');
  }

  window.ChatComposer = { init };
  window.toggleQuickReplies = toggleQuickReplies; // 全局兼容

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
