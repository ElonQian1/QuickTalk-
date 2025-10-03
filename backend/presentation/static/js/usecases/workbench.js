/**
 * 工作台/报表模块
 * 提供数据统计、趋势分析等功能
 */
(function(){
  'use strict';
  // 轻薄代理：全部委托给 UnifiedUsecases，避免重复实现
  window.viewAnalytics = function(){ return window.UnifiedUsecases.viewAnalytics(); };
  window.loadWorkbenchSummary = function(){ return window.UnifiedUsecases.loadWorkbenchSummary(); };
  window.renderWorkbench = function(summary){ return window.UnifiedUsecases.renderWorkbench(summary); };
  console.log('✅ 工作台模块已加载 (workbench.js → 代理 UnifiedUsecases)');
})();
