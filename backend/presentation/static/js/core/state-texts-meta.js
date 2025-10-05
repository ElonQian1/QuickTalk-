/* state-texts-meta.js
 * 为 StateTexts 键提供可选注释 (notes)，在 schema 导出时合并。
 * 使用：放在 state-texts.js 之后加载。
 */
(function(){
  'use strict';
  if (!window.StateTexts) return;
  if (!window.StateTexts.__META) window.StateTexts.__META = {};
  Object.assign(window.StateTexts.__META, {
    EMPTY_SHOPS: { note: '店铺列表空状态主标题' },
    EMPTY_ADD_FIRST_SHOP: { note: '首次使用引导文案：提示添加店铺' },
    MESSAGE_RATE_LIMIT: { note: '发送限流提示' },
    RECONNECT_LIMIT_REACHED: { note: '重连上限终止提示' },
    HEARTBEAT_SEND_FAIL: { note: '心跳发送异常日志' },
    ADAPTIVE_HEARTBEAT: { note: '自适应心跳调节结果日志' }
  });
  console.log('✅ StateTexts Meta 已加载 (__META notes 合并)');
})();
