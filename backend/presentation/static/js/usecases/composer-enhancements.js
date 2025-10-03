/*
 * 消息输入增强 (composer-enhancements.js)
 * - 快捷键发送(Enter)与换行(Shift+Enter)
 * - 粘贴图片占位提示与后续扩展点
 * - 输入中状态节流广播（reserved）
 * - 上传按钮点击占位
 */
(function(){
  'use strict';

  const STATE = { typing: false, lastTypingAt: 0 };

  function getComposer(){
    return document.getElementById('messageInput') || document.querySelector('[data-role="message-input"]');
  }

  function handleKeydown(e){
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = e.target.value.trim();
      if (!content) return;
      if (typeof window.sendMessage === 'function') {
        window.sendMessage(content);
        e.target.value = '';
      } else if (window.messageModule && typeof window.messageModule.sendText === 'function') {
        window.messageModule.sendText(content);
        e.target.value = '';
      } else {
        console.warn('未找到发送实现: sendMessage/messageModule.sendText');
      }
    }
  }

  function handlePaste(e){
    try {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items || !items.length) return;
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          console.log('📎 粘贴了图片，暂未实现直接上传，后续由上传模块接管');
          // 可扩展：读取 blob 并委托上传 usecase
          return; // 仅提示一次
        }
      }
    } catch(err){ console.warn('handlePaste error:', err); }
  }

  function handleInput(){
    // 预留：发送"正在输入"事件，做节流
    const now = Date.now();
    if (!STATE.typing || now - STATE.lastTypingAt > 3000) {
      STATE.typing = true;
      STATE.lastTypingAt = now;
      // 预留调用：window.messageModule?.notifyTyping()
    }
  }

  function wireButtons(){
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
      emojiBtn.addEventListener('click', function(){
        if (typeof window.showToast === 'function') {
          window.showToast('表情功能开发中...', 'info');
        }
      });
    }
    const mediaBtn = document.getElementById('mediaBtn');
    if (mediaBtn) {
      mediaBtn.addEventListener('click', function(){
        if (typeof window.showToast === 'function') {
          window.showToast('文件上传功能开发中...', 'info');
        }
      });
    }
  }

  let __inited = false;
  function init(){
    // 如果新的 ChatComposer 已加载，则交由其统一绑定，避免重复
    if (window.ChatComposer && typeof window.ChatComposer.init === 'function') {
      window.ChatComposer.init();
      return;
    }
    if (__inited) return; // 幂等保护
    const input = getComposer();
    if (!input) {
      console.log('composer 输入框未找到，跳过初始化');
      return;
    }
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('paste', handlePaste);
    input.addEventListener('input', handleInput);
    wireButtons();
    __inited = true;
    console.log('✅ 消息输入增强完成 (composer-enhancements.js)');
  }

  window.ComposerEnhancements = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
