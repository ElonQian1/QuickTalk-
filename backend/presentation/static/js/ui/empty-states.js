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

  function messages(){
    return build('📭', '暂无消息', '当前对话还没有消息记录');
  }

  function search(){
    return build('🔍', '未找到匹配结果', '试试其他搜索关键词');
  }

  function workbench(){
    return build('📊', '暂无数据', '当前统计周期内没有数据');
  }

  function generic(icon, title, desc){
    return build(icon || '📋', title || '暂无内容', desc || '');
  }

  window.EmptyStatesUI = { 
    build, 
    conversations, 
    shops, 
    messages, 
    search, 
    workbench,
    generic
  };
  console.log('✅ UI 组件已加载 (empty-states.js)');
})();

