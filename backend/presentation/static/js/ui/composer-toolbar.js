/* Composer Toolbar UI：表情/图片/语音等工具按钮桥接 */
(function(){
  'use strict';

  function get(id){ return document.getElementById(id); }

  function init(opts){
    const emojiBtn = get('emojiBtn');
    const mediaBtn = get('mediaBtn');
    const voiceBtn = get('voiceBtn');
    const fileInput = get('fileInput');

    if (emojiBtn) {
      emojiBtn.addEventListener('click', () => {
        if (opts && typeof opts.onEmoji === 'function') return opts.onEmoji();
        if (window.showToast) window.showToast('表情功能开发中...', 'info');
      }, { once: false });
    }

    if (mediaBtn && fileInput) {
      mediaBtn.addEventListener('click', () => {
        if (opts && typeof opts.onMedia === 'function') return opts.onMedia(fileInput);
        fileInput.click();
      }, { once: false });
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (opts && typeof opts.onVoice === 'function') return opts.onVoice();
        if (window.messageModule && typeof window.messageModule.toggleVoiceRecording === 'function') {
          window.messageModule.toggleVoiceRecording();
        } else if (window.showToast) window.showToast('语音功能开发中...', 'info');
      }, { once: false });
    }
  }

  window.ComposerToolbarUI = { init };
})();
