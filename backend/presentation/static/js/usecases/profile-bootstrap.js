/*
 * profile-bootstrap.js — 个人资料页交互胶水层
 * 负责为设置项绑定事件：用户信息、修改密码、通知设置、系统设置、关于、退出
 */
(function(){
  'use strict';

  function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); }

  function bind(){
    const root = document.getElementById('profilePage') || document;

    // 用户信息入口（如果有）
    const infoBtn = root.querySelector('[data-profile-action="user-info"]');
    on(infoBtn, 'click', function(){
      if (typeof window.showUserInfo === 'function') window.showUserInfo();
    });

    // 修改密码
    const changePw = root.querySelector('[data-profile-action="change-password"]');
    on(changePw, 'click', function(){
      if (typeof window.changePassword === 'function') window.changePassword();
    });

    // 通知设置
    const notif = root.querySelector('[data-profile-action="notifications"]');
    on(notif, 'click', function(){
      if (typeof window.notificationSettings === 'function') window.notificationSettings();
    });

    // 系统设置
    const system = root.querySelector('[data-profile-action="system"]');
    on(system, 'click', function(){
      if (typeof window.systemSettings === 'function') window.systemSettings();
    });

    // 关于
    const about = root.querySelector('[data-profile-action="about"]');
    on(about, 'click', function(){
      if (typeof window.aboutApp === 'function') window.aboutApp();
    });

    // 退出登录
    const logout = root.querySelector('[data-profile-action="logout"]');
    on(logout, 'click', function(){
      if (typeof window.logout === 'function') window.logout();
    });

    console.log('✅ profile-bootstrap.js 事件绑定完成');
  }

  // 幂等保护 + 延迟一次，等 partials 加载
  let __wired = false;
  function init(){
    if (__wired) return; __wired = true;
    // 部分组件通过 data-include 加载，延迟绑定
    setTimeout(bind, 300);
  }

  window.ProfileBootstrap = { init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
