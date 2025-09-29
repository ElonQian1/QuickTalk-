// Template for a single message (stateless)
(function(global){
  const QT = global.QuickTalk || {}; const Time = QT.Time; const File = QT.File; const K = QT.Models.MessageKinds;
  function escapeHtml(str){ return (str||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function renderMessage(msg){
    const isCustomer = msg.senderType === 'customer';
    let inner='';
    switch(msg.messageType){
      case K.IMAGE:
        inner = `<div class="message-image"><img src="${msg.fileUrl}" alt="${escapeHtml(msg.fileName||'图片')}"/></div>`;
        break;
      case K.FILE:
        if(msg.fileUrl && File.isImage(msg.fileUrl)){
          inner = `<div class="message-image"><img src="${msg.fileUrl}" alt="${escapeHtml(msg.fileName||'图片')}"/></div>`;
        } else {
          inner = `<div class="message-file"><div class="file-icon">📄</div><div class="file-name">${escapeHtml(msg.fileName||'文件')}</div></div>`;
        }
        break;
      default:
        inner = `<div class="message-text">${escapeHtml(msg.content)}</div>`;
    }
    return `<div class="message ${isCustomer?'message-customer':'message-staff'}"><div class="message-content">${inner}</div><div class="message-time">${Time.formatRelative(msg.createdAt)}</div></div>`;
  }
  global.QuickTalk = global.QuickTalk || {}; global.QuickTalk.Templates = global.QuickTalk.Templates || {}; global.QuickTalk.Templates.renderMessage = renderMessage;
    QT.Templates.renderMessageItem = function(msg){
      const cls = msg.senderType === 'agent' ? 'qt-msg-agent' : 'qt-msg-customer';
      const content = msg.fileUrl ? `<a href="${msg.fileUrl}" target="_blank">${QT.escapeHtml(msg.fileName||'文件')}</a>` : QT.escapeHtml(msg.content||'');
      return `<div class="qt-msg ${cls}" data-id="${msg.id}"><div class="qt-msg-inner">${content}</div></div>`;
    };
    if(!QT.escapeHtml){
      QT.escapeHtml = function(str){ return (str||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c)); };
    }
})(window);
