// QuickTalk Frontend Core Models (incremental extraction)
// Define canonical shapes to normalize disparate legacy message formats.
(function(global){
  const MessageKinds = Object.freeze({ TEXT:'text', IMAGE:'image', FILE:'file', AUDIO:'audio', VIDEO:'video', EMOJI:'emoji' });
  function normalizeMessage(raw){
    if(!raw) return null;
    const msg = {
      id: raw.id || raw.message_id || ('msg_'+Date.now()),
      conversationId: raw.conversation_id || raw.conversationId,
      shopId: raw.shop_id || raw.shopId || null,
      senderId: raw.sender_id || raw.user_id || raw.senderId || 'unknown',
      senderType: raw.sender_type || raw.senderType || raw.sender || 'unknown',
      content: raw.content || raw.message || '',
      messageType: raw.message_type || raw.messageType || inferType(raw),
      fileUrl: raw.file_url || raw.fileUrl || null,
      fileName: raw.file_name || raw.fileName || null,
      fileSize: raw.file_size || raw.fileSize || null,
      createdAt: raw.created_at || raw.timestamp || new Date().toISOString(),
      raw
    };
    return msg;
  }
  function inferType(raw){
    if(!raw) return MessageKinds.TEXT;
    if(raw.message_type || raw.messageType) return raw.message_type||raw.messageType;
    if(raw.file_url) return guessByExtension(raw.file_url);
    return MessageKinds.TEXT;
  }
  function guessByExtension(path){
    const lower=(path||'').toLowerCase();
    if(/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return MessageKinds.IMAGE;
    if(/\.(mp3|wav|ogg)$/.test(lower)) return MessageKinds.AUDIO;
    if(/\.(mp4|mov|webm)$/.test(lower)) return MessageKinds.VIDEO;
    return MessageKinds.FILE;
  }
  global.QuickTalk = global.QuickTalk || {};
  global.QuickTalk.Models = { MessageKinds, normalizeMessage };
})(window);
