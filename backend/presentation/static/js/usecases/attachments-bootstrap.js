/*
 * 附件上传入口胶水 (attachments-bootstrap.js)
 * - 负责为消息页的媒体/语音按钮提供幂等绑定
 * - 优先委托给 window.messageModule 的现有实现（sendFileDirectly / uploadFile / toggleVoiceRecording）
 * - 若页面无 #fileInput，则自动创建隐藏文件输入并挂载到页面
 */
(function(){
  'use strict';

  var WIRED = false;

  function ensureHiddenFileInput(){
    // 优先复用页面已有的 #fileInput（若已由 message-module 初始化，则直接使用）
    var existing = document.getElementById('fileInput');
    if (existing) return existing;

    // 动态创建一个隐藏的文件输入，便于在未集成时也可用
    var input = document.createElement('input');
    input.type = 'file';
    input.id = 'fileInput';
    input.multiple = true;
    input.accept = 'image/*,video/*,audio/*,*/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';

    document.body.appendChild(input);
    return input;
  }

  function toast(msg, type){
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type || 'info');
    } else {
      console.log('[toast]', msg);
    }
  }

  async function handleFiles(files){
    if (!files || !files.length) return;

    // 优先使用 messageModule 的能力
    var mm = window.messageModule;
    if (!mm) {
      toast('发送失败：消息模块未就绪', 'error');
      return;
    }

    if (!mm.currentConversationId) {
      toast('请先选择一个对话', 'error');
      return;
    }

    // 如果有专用方法，逐个发送
    if (typeof mm.sendFileDirectly === 'function') {
      for (var i = 0; i < files.length; i++) {
        try { await mm.sendFileDirectly(files[i]); } catch(e){ console.warn('sendFileDirectly error:', e); }
      }
      return;
    }

    // 回退方案：尝试使用 uploadFile + 手动构造 WebSocket 消息（若 websocket 存在）
    if (typeof mm.uploadFile === 'function') {
      for (var j = 0; j < files.length; j++) {
        try {
          var up = await mm.uploadFile(files[j]);
          if (up && up.success && up.url) {
            var payload = {
              type: 'message',
              conversation_id: mm.currentConversationId,
              content: '',
              files: [{ url: up.url, type: files[j].type, name: files[j].name, size: files[j].size }],
              sender_type: 'agent',
              timestamp: Date.now()
            };
            var ws = (mm.websocket || window.websocket);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(payload));
            }
            // 乐观渲染
            if (Array.isArray(mm.messages)) mm.messages.push(payload);
            if (typeof mm.renderMessage === 'function') mm.renderMessage(payload);
            if (typeof mm.scrollToBottom === 'function') mm.scrollToBottom();
          }
        } catch(err){ console.error('upload fallback error:', err); }
      }
      return;
    }

    toast('文件发送功能暂不可用', 'warning');
  }

  function bind(){
    // 目标按钮
    var mediaBtn = document.getElementById('mediaBtn');
    var voiceBtn = document.getElementById('voiceBtn');
    var fileInput = ensureHiddenFileInput();

    if (mediaBtn) {
      // 不改变 message-module 的既有行为：若其已绑定 #fileInput.change，我们仍然触发 click
      mediaBtn.addEventListener('click', function(){
        if (!fileInput) fileInput = ensureHiddenFileInput();
        // 某些浏览器对多次赋值有缓存，确保清空以便可重复选择同一文件
        try { fileInput.value = ''; } catch(_e) {}
        fileInput.click();
      });
    }

    if (fileInput) {
      // 附加一层兜底 change 处理（不阻断既有监听）
      fileInput.addEventListener('change', function(ev){
        var fs = ev && ev.target && ev.target.files; 
        if (!fs || !fs.length) return;
        // 优先交给 messageModule 内部处理（若其在 initMediaHandlers 中也监听了 change，浏览器会依次触发，这里做一次轻量并去重并不易保障，保持幂等友好）
        if (window.messageModule && typeof window.messageModule.handleFileSelection === 'function') {
          try { window.messageModule.handleFileSelection(fs); } catch(_err) {}
        } else {
          handleFiles(fs);
        }
        // 清空文件选择值，允许重复选择相同文件
        try { ev.target.value = ''; } catch(_e2) {}
      });
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', function(){
        var mm = window.messageModule;
        if (mm && typeof mm.toggleVoiceRecording === 'function') {
          mm.toggleVoiceRecording();
        } else {
          toast('录音功能暂不可用', 'info');
        }
      });
    }

    console.log('✅ 附件上传入口已就绪 (attachments-bootstrap.js)');
  }

  function init(){
    if (WIRED) return; WIRED = true;
    // 延迟一点点，等待主要 DOM 片段插入
    setTimeout(bind, 200);
  }

  window.AttachmentsBootstrap = { init, attachFiles: handleFiles };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
