/**
 * message-type-registry.js
 * 统一维护消息类型策略：渲染类名、图标、预处理、校验
 */
(function(){
  if (window.MessageTypeRegistry) return;
  const NS='messageCore';
  const log=(lvl,...a)=>{ if(window.QT_LOG){ (QT_LOG[lvl]||QT_LOG.debug)(NS,...a);} };
  const _types=new Map();
  function register(name, def){ if(!name) return; _types.set(name, Object.assign({ name, icon:'💬', className:'msg-text', validate:()=>true, normalize:o=>o }, def||{})); }
  function get(name){ return _types.get(name)||_types.get('text'); }
  function list(){ return Array.from(_types.keys()); }
  function normalizeMessage(msg){ const t=get(msg.message_type||'text'); try { return t.normalize? t.normalize(msg): msg; } catch(e){ log('warn','normalize error',e); return msg; } }
  // 内置类型
  register('text',{ icon:'💬', className:'msg-text' });
  register('image',{ icon:'🖼️', className:'msg-image', validate: m=> Array.isArray(m.files)&&m.files.some(f=>/^image\//.test(f.type||'')) });
  register('file',{ icon:'📎', className:'msg-file' });
  register('audio',{ icon:'🎤', className:'msg-audio' });
  window.MessageTypeRegistry={ register,get,list,normalizeMessage };
  log('info','MessageTypeRegistry 初始化: '+list().join(','));
})();
