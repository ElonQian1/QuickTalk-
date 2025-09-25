// Adapt raw server websocket events to normalized internal events
(function(global){
  const { normalizeMessage } = (global.QuickTalk && global.QuickTalk.Models) || {};
  function adapt(raw){
    if(!raw || typeof raw !== 'object') return null;
    // Legacy mapping
    switch(raw.type){
      case 'new_message':
      case 'staff_message':
      case 'new_user_message': {
        const msg = raw.message || raw; // some variants embed in message field
        return { kind: 'message.appended', payload: normalizeMessage(msg) };
      }
      case 'conversation_update':
        return { kind: 'conversation.updated', payload: raw.conversation || raw.payload };
      case 'error':
        return { kind: 'error', payload: raw };
      default:
        // Potential future domain event envelope {version,type,data}
        if(raw.version === 'v1' && raw.type){
          if(raw.type === 'domain.event.message_appended'){
            return { kind: 'message.appended', payload: normalizeMessage(raw.data && raw.data.message) };
          }
        }
        return { kind: 'unknown', payload: raw };
    }
  }
  global.QuickTalk = global.QuickTalk || {};
  global.QuickTalk.Protocol = { adapt };
})(window);
