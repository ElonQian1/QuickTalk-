/*
 * UI: 空状态组件 (empty-states.js)
 * - 生成通用空状态节点：图标、标题、描述
 */
(function(){
  'use strict';

  function build(icon, title, desc){
    var wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.innerHTML = [
      '<div class="empty-icon">', icon ,'</div>',
      '<div class="empty-title">', title ,'</div>',
      '<div class="empty-desc">', desc ,'</div>'
    ].join('');
    return wrap;
  }

  function conversations(){
    return build('💬', '暂无对话', '等待客户发起对话');
  }

  function shops(){
    return build('🏪', '暂无可用店铺', '只有审核通过的店铺才会在此显示；请在店铺通过审核后再来处理客服消息');
  }

  window.EmptyStatesUI = { build, conversations, shops };
  console.log('✅ UI 组件已加载 (empty-states.js)');
})();
