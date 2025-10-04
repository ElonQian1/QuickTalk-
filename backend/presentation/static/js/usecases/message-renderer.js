/* message-renderer.js
 * 职责：纯渲染层（消息列表 / 单条消息 / 媒体 / 图片预览）
 * 依赖：可选 UI 组件（MessageBubbleUI / MessageMediaUI / LoadingStatesUI / EmptyStatesUI）
 * 约束：无网络请求 / 无状态突变（业务状态由 MessageModule 管理）
 */
(function(){
  'use strict';
  if (window.MessageRenderer) return; // 幂等

  function safeAppend(parent, child){
    try { parent.appendChild(child); } catch(_){}
  }

  const Renderer = {
    ctx: null,
    init(ctx){ this.ctx = ctx; return this; },

    renderMessages(){
      const ctx = this.ctx;
      const container = document.getElementById('chatMessages');
      if (!container) return;
      container.innerHTML = '';
      const list = ctx.messages;
      if (!Array.isArray(list) || list.length === 0) { return; }
      list.forEach(m => this.renderMessage(m));
      ctx.scrollToBottom && ctx.scrollToBottom();
      try { if (window.MessagesPagination && typeof window.MessagesPagination.apply==='function') window.MessagesPagination.apply(); } catch(_e){}
    },

    renderMessage(message){
      const ctx = this.ctx;
      const container = document.getElementById('chatMessages');
      if (!container) return;
      // 优先使用统一气泡组件
      if (window.MessageBubbleUI && typeof window.MessageBubbleUI.create === 'function') {
        const node = window.MessageBubbleUI.create(message, { currentCustomerName: ctx.currentCustomer?.name });
        safeAppend(container, node);
        try { container.dispatchEvent(new CustomEvent('message:rendered', { detail: { id: message.id } })); } catch(_e){}
        return;
      }
      // 回退：原内联 DOM 生成
      const messageDiv = document.createElement('div');
      messageDiv.className = `chat-message ${message.sender_type}`;
      const avatar = message.sender_type === 'customer' ? (ctx.currentCustomer?.name || 'C').charAt(0) : 'A';
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      if (message.content && message.content.trim()) {
        const textContent = document.createElement('div');
        textContent.textContent = message.content;
        bubble.appendChild(textContent);
      }
      if (Array.isArray(message.files) && message.files.length){
        message.files.forEach(file => bubble.appendChild(this.createMediaElement(file)));
      }
      messageDiv.innerHTML = `<div class="message-avatar">${avatar}</div>`;
      messageDiv.appendChild(bubble);
      safeAppend(container, messageDiv);
    },

    createMediaElement(file){
      if (window.MessageMediaUI && typeof window.MessageMediaUI.createMediaElement === 'function') {
        return window.MessageMediaUI.createMediaElement(file);
      }
      const mediaDiv = document.createElement('div');
      if (!file || !file.url || file.url === 'undefined') { mediaDiv.innerHTML = '<p>文件URL无效</p>'; return mediaDiv; }
      try {
        if (file.type?.startsWith('image/')) {
          mediaDiv.className = 'message-media';
          const img = document.createElement('img');
          img.src = file.url; img.alt = file.name || '图片';
            img.onclick = () => this.openImageModal(file.url);
          img.onerror = () => { img.alt = '图片加载失败'; };
          mediaDiv.appendChild(img);
        } else if (file.type?.startsWith('audio/')) {
          mediaDiv.className = 'message-audio';
          const audio = document.createElement('audio');
          audio.controls = true; audio.src = file.url; audio.preload = 'metadata';
          mediaDiv.appendChild(audio);
        } else if (file.type?.startsWith('video/')) {
          mediaDiv.className = 'message-media';
          const video = document.createElement('video');
          video.controls = true; video.src = file.url; video.style.maxWidth='100%'; video.style.borderRadius='8px';
          mediaDiv.appendChild(video);
        } else {
          mediaDiv.className = 'message-file';
          const size = typeof this.ctx.formatFileSize === 'function' ? this.ctx.formatFileSize(file.size) : (file.size||0)+'B';
          mediaDiv.innerHTML = `<div class="file-icon">${this.ctx.getFileIcon ? this.ctx.getFileIcon(file.type||'') : '📁'}</div><div class="file-details"><div class="file-name">${file.name||'文件'}</div><div class="file-size">${size}</div></div>`;
          mediaDiv.onclick = () => window.open(file.url, '_blank');
        }
      } catch(e){ console.warn('createMediaElement fallback error', e); }
      return mediaDiv;
    },

    openImageModal(src){
      if (window.MessageMediaUI && typeof window.MessageMediaUI.openImageModal === 'function') {
        return window.MessageMediaUI.openImageModal(src);
      }
      const modal = document.createElement('div');
      modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:1000;';
      const img = document.createElement('img');
      img.src = src; img.style.cssText='max-width:90%;max-height:90%;object-fit:contain;';
      const close = document.createElement('button');
      close.textContent='×';
      close.style.cssText='position:absolute;top:20px;right:20px;background:rgba(255,255,255,.8);border:none;border-radius:50%;width:40px;height:40px;font-size:24px;cursor:pointer;';
      close.onclick = () => document.body.removeChild(modal);
      modal.onclick = (e)=>{ if(e.target===modal) document.body.removeChild(modal); };
      modal.appendChild(img); modal.appendChild(close); document.body.appendChild(modal);
    }
  };

  window.MessageRenderer = Renderer;
  console.log('✅ message-renderer.js 已加载');
})();
