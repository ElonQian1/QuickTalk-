/*
 * 统一UI组件模块 (unified-ui-components.js)
 * 
 * 整合核心UI组件功能：
 * - MessageMediaUI: 消息媒体渲染（图片/音频/视频/文件）
 * - ChatHeaderUI: 聊天头部更新
 * - ConversationItemUI: 对话项渲染
 * - ShopCardUI: 店铺卡片渲染
 * 
 * 重构自原独立文件，统一管理UI渲染逻辑
 * 兼容新旧模块系统，提供向后兼容性
 */
(function(){
  'use strict';

  // UIHelper - 提供标准化的DOM操作方法
  const UIHelper = {
    createElement(tag, options = {}) {
      const element = document.createElement(tag);
      
      // 设置className
      if (options.className) {
        element.className = options.className;
      }
      
      // 设置属性
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
      
      // 设置样式
      if (options.styles) {
        Object.entries(options.styles).forEach(([key, value]) => {
          element.style[key] = value;
        });
      }
      
      // 设置文本内容
      if (options.textContent !== undefined) {
        element.textContent = options.textContent;
      }
      
      // 设置HTML内容
      if (options.innerHTML !== undefined) {
        element.innerHTML = options.innerHTML;
      }
      
      return element;
    }
  };

  // ====== MessageMediaUI 模块 ======
  function getFileIcon(mimeType){
    if (!mimeType) return '📁';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('text')) return '📃';
    return '📁';
  }

  function formatFileSize(bytes){
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function openImageModal(imageSrc){
    const modal = UIHelper.createElement('div', {
      styles: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000'
      }
    });

    const img = UIHelper.createElement('img', {
      attributes: { src: imageSrc },
      styles: {
        maxWidth: '90%',
        maxHeight: '90%',
        objectFit: 'contain'
      }
    });

    const closeBtn = UIHelper.createElement('button', {
      textContent: '×',
      styles: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(255,255,255,0.8)',
        border: 'none',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        fontSize: '24px',
        cursor: 'pointer'
      }
    });

    closeBtn.onclick = function(){ if (modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.onclick = function(e){ if (e.target === modal && modal.parentNode) modal.parentNode.removeChild(modal); };

    modal.appendChild(img);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
  }

  function createMediaElement(file){
    const mediaDiv = UIHelper.createElement('div');

    if (!file || !file.url || file.url === 'undefined') {
      console.error('文件URL无效:', file);
      mediaDiv.innerHTML = '<p>文件URL无效</p>';
      return mediaDiv;
    }

    if (file.type && file.type.startsWith && file.type.startsWith('image/')) {
      mediaDiv.className = 'message-media';
      const img = UIHelper.createElement('img', {
        attributes: {
          src: file.url,
          alt: file.name || '图片'
        }
      });
      img.onclick = function(){ openImageModal(file.url); };
      img.onerror = function(){ console.error('图片加载失败:', file.url); img.alt = '图片加载失败'; };
      mediaDiv.appendChild(img);
      return mediaDiv;
    }

    if (file.type && file.type.startsWith && file.type.startsWith('audio/')) {
      mediaDiv.className = 'message-audio';
      const audio = UIHelper.createElement('audio', {
        attributes: {
          controls: 'true',
          src: file.url,
          preload: 'metadata'
        }
      });
      mediaDiv.appendChild(audio);
      return mediaDiv;
    }

    if (file.type && file.type.startsWith && file.type.startsWith('video/')) {
      mediaDiv.className = 'message-media';
      const video = UIHelper.createElement('video', {
        attributes: {
          controls: 'true',
          src: file.url
        },
        styles: {
          maxWidth: '100%',
          borderRadius: '8px'
        }
      });
      mediaDiv.appendChild(video);
      return mediaDiv;
    }

    // 其他类型：文件卡片
    mediaDiv.className = 'message-file';
    mediaDiv.innerHTML = [
      '<div class="file-icon">', getFileIcon(file.type), '</div>',
      '<div class="file-details">',
        '<div class="file-name">', (file.name || '文件'), '</div>',
        '<div class="file-size">', formatFileSize(file.size), '</div>',
      '</div>'
    ].join('');
    mediaDiv.onclick = function(){ window.open(file.url, '_blank'); };
    return mediaDiv;
  }

  var MessageMediaUI = {
    createMediaElement: createMediaElement,
    openImageModal: openImageModal,
    getFileIcon: getFileIcon,
    formatFileSize: formatFileSize
  };

  // ====== ChatHeaderUI 模块 ======
  function text(el, value){ if (el) el.textContent = value; }
  function show(el){ if (el) el.style.display = 'inline-block'; }

  function computeCustomerName(conversation){
    try {
      if (window.ConversationUtils && typeof window.ConversationUtils.formatCustomerName === 'function') {
        return window.ConversationUtils.formatCustomerName(conversation.customer_id, conversation.customer_name);
      }
      return conversation.customer_name || (conversation.customer_id ? String(conversation.customer_id) : '客户');
    } catch(_e){ return conversation.customer_name || '客户'; }
  }

  function setAvatar(conversation){
    var el = document.getElementById('customerAvatar');
    if (!el) return;
    if (window.ConversationUtils && typeof window.ConversationUtils.generateAvatarInitial === 'function'){
      var initial = window.ConversationUtils.generateAvatarInitial(conversation.customer_id, conversation.customer_name);
      var theme = window.ConversationUtils.generateAvatarTheme && window.ConversationUtils.generateAvatarTheme(conversation.customer_id);
      text(el, initial);
      el.className = 'customer-avatar' + (theme ? (' ' + theme) : '');
      return;
    }
    var name = conversation.customer_name || 'C';
    text(el, name.charAt(0).toUpperCase());
  }

  function updateForConversation(conversation, opts){
    opts = opts || {};
    var backBtn = document.getElementById('messagesBackBtn');
    var titleEl = document.getElementById('messagesTitle');
    var nameEl = document.getElementById('customerName');

    if (backBtn) { text(backBtn, '← 对话列表'); show(backBtn); }

    var displayName = opts.customerName || computeCustomerName(conversation);
    text(titleEl, displayName);
    if (nameEl) text(nameEl, displayName);
    setAvatar(conversation);
  }

  var ChatHeaderUI = { updateForConversation };

  // ====== ConversationItemUI 模块 ======
  function createConversationItem(conversation, options){
    options = options || {};
    const el = UIHelper.createElement('div', {
      className: 'conversation-item',
      attributes: {
        'data-conversation-id': conversation.id,
        ...(conversation.shop_id && { 'data-shop-id': conversation.shop_id })
      }
    });

    // 使用规范化数据
    var normalized = window.ConversationNormalizer ? 
        window.ConversationNormalizer.normalize(conversation) : 
        { lastMessageText: '', unreadCount: 0, customerName: '客户' };
    
    var lastMessageTime = conversation.last_message_time ?
      new Date(conversation.last_message_time).toLocaleString() : '暂无消息';
    
    // 调试信息
    el.__raw = conversation;
    el.__normalized = normalized;

    if (window.ConversationUtils) {
      var messageToShow = normalized.lastMessageText || conversation.last_message || conversation.last_message_content || '等待客户消息...';
      el.innerHTML = [
        window.ConversationUtils.generateAvatarHTML({
          customerId: conversation.customer_id,
          customerName: conversation.customer_name,
          unreadCount: normalized.unreadCount || conversation.unread_count || 0
        }),
        '<div class="conversation-content">',
          '<div class="conversation-header">',
            '<span class="customer-name">',
              window.ConversationUtils.formatCustomerName(conversation.customer_id, conversation.customer_name),
            '</span>',
            '<span class="message-time" data-conversation-id="', conversation.id ,'">', lastMessageTime, '</span>',
          '</div>',
          '<div class="last-message" data-conversation-id="', conversation.id ,'">', messageToShow, '</div>',
        '</div>'
      ].join('');
      if (normalized.unreadCount > 0 || conversation.unread_count > 0) el.classList.add('has-unread');
    } else {
      var displayName = normalized.customerName || conversation.customer_name || String(conversation.customer_id || '客户');
      var avatarInitial = displayName.charAt(displayName.length - 3) || 'C';
      var messageToShow = normalized.lastMessageText || conversation.last_message || conversation.last_message_content || '等待客户消息...';
      el.innerHTML = [
        '<div class="conversation-avatar">', avatarInitial, '<div class="avatar-meta-slot"></div></div>',
        '<div class="conversation-content">',
          '<div class="conversation-header">',
            '<span class="customer-name">', displayName ,'</span>',
            '<span class="message-time" data-conversation-id="', conversation.id ,'">', lastMessageTime, '</span>',
          '</div>',
          '<div class="last-message" data-conversation-id="', conversation.id ,'">', messageToShow, '</div>',
        '</div>',
        (normalized.unreadCount > 0 ? ('<div class="unread-badge" data-conversation-id="' + conversation.id + '">' + normalized.unreadCount + '</div>') : '')
      ].join('');
    }

    // 确保 avatar-meta-slot 存在（即便使用 ConversationUtils 生成头像）
    try {
      var avatarEl = el.querySelector('.conversation-avatar');
      if (avatarEl && !avatarEl.querySelector('.avatar-meta-slot')){
        const meta = UIHelper.createElement('div', {
          className: 'avatar-meta-slot'
        });
        avatarEl.appendChild(meta);
      }
    } catch(_){}

    if (window.DOMEnhancer) {
      try { window.DOMEnhancer.enhanceConversationItem(el, conversation); } catch(_e){}
    }

    if (typeof options.onClick === 'function') {
      el.addEventListener('click', function(){ options.onClick(conversation); });
    }

    return el;
  }

  var ConversationItemUI = { create: createConversationItem };

  // ========= 增量更新能力 =========
  function updateConversationItem(conversationOrId, patch){
    var conv = (typeof conversationOrId === 'object') ? conversationOrId : (patch||{});
    if (typeof conversationOrId !== 'object') conv.id = conversationOrId;
    if (!conv.id) return;
    if (window.ConversationNormalizer) conv = Object.assign({}, conv, window.ConversationNormalizer.normalize(conv));

    var nodes = document.querySelectorAll('.conversation-item[data-conversation-id="' + conv.id + '"]');
    nodes.forEach(function(el){
      // 更新名称
      if (conv.customerName){
        var nameEl = el.querySelector('.customer-name');
        if (nameEl && nameEl.textContent !== conv.customerName) nameEl.textContent = conv.customerName;
      }
      // 更新时间
      if (conv.lastMessageTime){
        var timeEl = el.querySelector('.message-time');
        if (timeEl){
          try { timeEl.textContent = new Date(conv.lastMessageTime).toLocaleString(); } catch(_){}
        }
      }
      // 更新最后消息
      if (conv.lastMessageText != null){
        var msgEl = el.querySelector('.last-message');
        if (msgEl){
          msgEl.textContent = conv.lastMessageText || '';
          // 长消息淡出遮罩逻辑
          if ((conv.lastMessageText||'').length > 60){
            msgEl.classList.add('fade-mask');
          } else {
            msgEl.classList.remove('fade-mask');
          }
        }
      }
      // 未读状态 & 数字
      if (typeof conv.unreadCount === 'number'){
        el.classList.toggle('has-unread', conv.unreadCount > 0);
        var badge = el.querySelector('.unread-badge');
        if (badge){
          if (conv.unreadCount > 0){
            badge.textContent = conv.unreadCount > 99 ? '99+' : String(conv.unreadCount);
            badge.style.display = 'flex';
          } else {
            badge.style.display = 'none';
          }
        }
        // avatar meta slot 作为降级显示
        var avatarMeta = el.querySelector('.avatar-meta-slot');
        if (avatarMeta){
          if (conv.unreadCount > 0 && !el.querySelector('.unread-badge-component')){
            avatarMeta.textContent = conv.unreadCount > 99 ? '99+' : String(conv.unreadCount);
            avatarMeta.style.display = 'flex';
          } else {
            avatarMeta.textContent = '';
            avatarMeta.style.display = 'none';
          }
        }
        // 同步给 Adapter（若存在）
        if (window.ConversationBadgeAdapter && typeof window.ConversationBadgeAdapter.update === 'function'){
          window.ConversationBadgeAdapter.update(conv.id, conv.unreadCount);
        }
      }
    });
    // 广播更新事件
    var evt; try { evt = new CustomEvent('conversation:item:updated', { detail: conv }); } catch(_){ evt = null; }
    if (evt) document.dispatchEvent(evt);
  }


  // ====== ShopCardUI 模块 ======
  function buildShopCard(shop, options){
    options = options || {};
    var unread = Number(shop.unreadCount || 0);
    var hasConversations = !!options.hasConversations;
    var effStatus = (shop.approvalStatus || shop.status || 'pending');
    var isInactive = (effStatus === 'inactive') || (!hasConversations);

    const card = UIHelper.createElement('div', {
      className: 'shop-card ' + (isInactive ? 'shop-card-inactive' : ''),
      attributes: {
        'data-shop-id': shop.id
      }
    });

    card.innerHTML = [
      '<div class="shop-header">',
        '<div class="shop-icon">', (shop.name || 'S').charAt(0) ,'</div>',
      '</div>',
      '<div class="shop-name">',
        (shop.name || '未命名店铺'),
      '</div>',
      '<div class="shop-domain">', (shop.domain || '未设置域名') ,'</div>',
      '<div class="shop-unread-badge" data-unread="', unread ,'" style="display:', (unread>0?'flex':'none') ,'">',
        '<span class="unread-number">', unread ,'</span>',
        '<span class="unread-label">未读</span>',
      '</div>',
      '<div class="shop-meta">',
        '<div class="shop-actions">', (options.actionsHTML || '') ,'</div>',
      '</div>',
      (shop.membership === 'employee' ? '<div class="shop-role-badge">员工</div>' : '')
    ].join('');

    if (typeof options.onClick === 'function') {
      card.addEventListener('click', function(evt){ options.onClick(shop, evt); });
    }
    return card;
  }

  var ShopCardUI = { build: buildShopCard };

  // ====== 统一导出类 ======
  class UnifiedUIComponents {
    constructor() {
      this.MessageMediaUI = MessageMediaUI;
      this.ChatHeaderUI = ChatHeaderUI;
      this.ConversationItemUI = ConversationItemUI;
      this.ShopCardUI = ShopCardUI;
    }

    // 代理方法 - 消息媒体
    createMediaElement(file) {
      return this.MessageMediaUI.createMediaElement(file);
    }

    openImageModal(imageSrc) {
      return this.MessageMediaUI.openImageModal(imageSrc);
    }

    // 代理方法 - 聊天头部
    updateChatHeader(conversation, opts) {
      return this.ChatHeaderUI.updateForConversation(conversation, opts);
    }

    // 代理方法 - 对话项
    createConversationItem(conversation, options) {
      return this.ConversationItemUI.create(conversation, options);
    }

    updateConversationItem(conversationOrId, patch){
      return updateConversationItem(conversationOrId, patch);
    }

    // 代理方法 - 店铺卡片
    buildShopCard(shop, options) {
      return this.ShopCardUI.build(shop, options);
    }
  }

  // 创建全局实例
  var unifiedUIComponents = new UnifiedUIComponents();

  // 向后兼容：保持原有全局对象
  window.MessageMediaUI = MessageMediaUI;
  window.ChatHeaderUI = ChatHeaderUI;
  window.ConversationItemUI = ConversationItemUI;
  window.ShopCardUI = ShopCardUI;

  // 新的统一接口
  window.UnifiedUIComponents = unifiedUIComponents;

  // 模块系统注册
  if (window.ModuleRegistry) {
    window.ModuleRegistry.register('UnifiedUIComponents', UnifiedUIComponents, []);
  }

  // 旧模块系统兼容
  if (window.ModuleLoader && window.ModuleLoader.defineClass) {
    window.ModuleLoader.defineClass('UnifiedUIComponents', function() {
      return UnifiedUIComponents;
    });
  }

  console.log('✅ 统一UI组件模块已加载 (unified-ui-components.js) - 包含 MessageMedia, ChatHeader, ConversationItem, ShopCard');
})();