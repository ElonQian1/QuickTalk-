/* state-texts-schema-export.js
 * 生成 StateTexts schema 信息 (key, defaultValue, group, note)
 * 使用方式：在浏览器控制台执行 window.exportStateTextsSchema()
 */
(function(){
  'use strict';
  if (window.exportStateTextsSchema) return;
  function detectGroup(key){
    if (key.startsWith('EMPTY_')) return 'empty';
    if (key.startsWith('LOADING_')) return 'loading';
    if (key.startsWith('MESSAGE_')) return 'message';
    if (key.startsWith('UPLOAD_')) return 'upload';
    if (key.startsWith('NETWORK_')) return 'network';
    if (key.startsWith('ERROR_')) return 'error';
    if (key.endsWith('_FAIL')) return 'fail';
    if (key.includes('RECONNECT')) return 'reconnect';
    if (key.includes('HEARTBEAT')) return 'heartbeat';
    if (key.includes('ADAPTIVE')) return 'adaptive';
    return 'misc';
  }

  function autoNote(key){
    if (key.startsWith('EMPTY_')) return '空状态 UI 文案';
    if (key.startsWith('LOADING_')) return '加载中提示';
    if (key.startsWith('MESSAGE_')) return '消息发送/校验/状态反馈';
    if (key.startsWith('UPLOAD_')) return '上传失败或提示';
    if (key.includes('RECONNECT')) return 'WebSocket 重连流程日志/提示';
    if (key.includes('HEARTBEAT')) return 'WebSocket 心跳相关日志/错误';
    if (key.includes('ADAPTIVE')) return 'WebSocket 自适应心跳调节日志';
    if (key.endsWith('_FAIL')) return '通用失败提示';
    if (key.startsWith('ERROR_')) return '错误加载/通用失败描述';
    return '';
  }
  window.exportStateTextsSchema = function(){
    if (!window.StateTexts){ console.warn('StateTexts 未初始化'); return []; }
    const meta = (window.StateTexts.__META && typeof window.StateTexts.__META === 'object') ? window.StateTexts.__META : {};
    const out = Object.keys(window.StateTexts).sort().map(k => ({
      key: k,
      defaultValue: window.StateTexts[k],
      group: detectGroup(k),
      note: (meta[k] && meta[k].note) ? meta[k].note : autoNote(k)
    }));
    try {
      const blob = new Blob([JSON.stringify(out, null, 2)], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      console.log('StateTexts schema 导出完成: 下载链接 (临时)', url);
    } catch(_){ /* 非浏览器环境忽略 */ }
    return out;
  };
  console.log('✅ state-texts-schema-export 已加载 (exportStateTextsSchema)');
})();
