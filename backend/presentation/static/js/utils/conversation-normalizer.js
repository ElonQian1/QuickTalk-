/* conv  function normalize(raw){
    if(!raw||typeof raw!="object") return { id: undefined, lastMessageText:"", unreadCount:0, lastMessageTime:null, customerName:"" };
    var id = raw.id || raw.conversation_id;
    var lastMessageText = raw.last_message_content || raw.last_message || raw.last_message_text || 
                          raw.latest_message || raw.preview || raw.lastMessage || raw.content || 
                          raw.message_content || raw.messageContent || '';
    // 某些后端返回对象可能把最新消息放在 messages[0]
    if(!lastMessageText && Array.isArray(raw.messages) && raw.messages.length){
      lastMessageText = raw.messages[raw.messages.length-1].content || raw.messages[raw.messages.length-1].message_content || '';
    }-normalizer.js
 * 统一会话数据字段，消除 last_message / last_message_content / content 等差异
 * 仅前端展示用途，不改变原始对象结构
 */
(function(){
  'use strict';

  function normalize(raw){
    if(!raw||typeof raw!=="object") return { id: undefined, lastMessageText:"", unreadCount:0, lastMessageTime:null, customerName:"" };
    var id = raw.id || raw.conversation_id;
    
    // 优先使用后端新字段，然后回退到旧字段兼容
    var lastMessageText = raw.last_message || raw.last_message_content || raw.last_message_text || 
                          raw.latest_message || raw.preview || raw.lastMessage || raw.content || 
                          raw.message_content || raw.messageContent || '';
    
    // 某些后端返回对象可能把最新消息放在 messages[0]
    if(!lastMessageText && Array.isArray(raw.messages) && raw.messages.length){
      lastMessageText = raw.messages[raw.messages.length-1].content || raw.messages[raw.messages.length-1].message_content || '';
    }
    
    // 优先使用后端计算的未读数
    var unreadCount = Number(raw.unread_count != null ? raw.unread_count : 
                            (raw.unreadCount != null ? raw.unreadCount : 0)) || 0;
    
    // 优先使用后端提供的时间戳
    var lastMessageTime = raw.last_message_time || raw.lastMessageTime || raw.timestamp || raw.sent_at || null;
    var customerName = raw.customer_name || raw.customerName || raw.customer_id || raw.customerId || '客户';
    return { id, lastMessageText, unreadCount, lastMessageTime, customerName };
  }

  window.ConversationNormalizer = { normalize };
  console.log('✅ conversation-normalizer 已加载');
})();
