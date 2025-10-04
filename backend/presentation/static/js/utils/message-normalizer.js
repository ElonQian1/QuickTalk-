(function(){
  'use strict';
  if (window.MessageNormalizer) return; // 幂等

  function normalizeSenderType(raw){
    if(!raw) return 'unknown';
    const r = String(raw).toLowerCase();
    const cfg = (window.QT_CONFIG && window.QT_CONFIG.senderAliases) || {};
    const agentAliases = cfg.agent || ['agent','admin','employee','staff','service','kefu'];
    const customerAliases = cfg.customer || ['customer','user','visitor','client','guest'];
    if(agentAliases.includes(r)) return 'agent';
    if(customerAliases.includes(r)) return 'customer';
    return r; // 其余保持原样（如 system 等）
  }

  function ensureMessageShape(msg){
    if(!msg || typeof msg !== 'object') return msg;
    // 标准字段别名归并
    msg.id = msg.id || msg.message_id || msg._id;
    msg.conversation_id = msg.conversation_id || msg.conversationId || (msg.conversation && (msg.conversation.id||msg.conversation.conversation_id));
    msg.shop_id = msg.shop_id || msg.shopId || msg.shopID || (msg.shop && (msg.shop.id||msg.shop.shop_id));
    msg.sender_type = normalizeSenderType(msg.sender_type || msg.senderType || msg.sender || msg.role);
    // 补时间戳
    msg.created_at = msg.created_at || msg.sent_at || msg.timestamp || new Date().toISOString();
    return msg;
  }

  function normalizeIncoming(raw){
    if(!raw) return raw;
    const base = raw.message ? raw.message : raw; // 若是封装层
    ensureMessageShape(base);
    return raw;
  }

  window.MessageNormalizer = { normalizeSenderType, ensureMessageShape, normalizeIncoming };
  console.log('✅ message-normalizer.js 已加载');
})();
