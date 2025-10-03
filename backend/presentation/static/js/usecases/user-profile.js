/**
 * 用户配置模块
 * 提供用户信息查看、密码修改、通知设置等功能
 */
(function(){
  'use strict';
  // 轻薄代理 + 兜底，避免 UnifiedUsecases 尚未定义时异常
  function callOrWarn(name, fallback){
    try {
      if (window.UnifiedUsecases && typeof window.UnifiedUsecases[name] === 'function') {
        return window.UnifiedUsecases[name]();
      }
      if (typeof fallback === 'function') return fallback();
    } catch(e){ console.warn('user-profile proxy error:', name, e); }
  }

  window.showUserInfo = function(){ return callOrWarn('showUserInfo'); };
  window.changePassword = function(){ return callOrWarn('changePassword'); };
  window.notificationSettings = function(){ return callOrWarn('notificationSettings'); };
  window.systemSettings = function(){ return callOrWarn('systemSettings'); };
  window.aboutApp = function(){ return callOrWarn('aboutApp'); };
  window.initializeProfilePage = function(){ return callOrWarn('initializeProfilePage'); };
  console.log('✅ 用户配置模块已加载 (user-profile.js → 代理 UnifiedUsecases)');
})();
