/*
 * App 初始化模块 (app-init.js)
 * - 负责应用启动的初始化流程
 * - 解耦 DOMContentLoaded 入口与具体功能实现
 * - 保持对现有全局函数的兼容（存在则调用，不存在则忽略）
 */
(function() {
  'use strict';

  // 简单的安全调用工具
  function callIfFunc(obj, name, ...args) {
    try {
      const fn = obj && obj[name];
      if (typeof fn === 'function') {
        return fn.apply(obj, args);
      }
    } catch (err) {
      console.warn('callIfFunc error:', name, err);
    }
    return undefined;
  }

  // 初始化增强模块（与原始实现保持一致的调用顺序与日志）
  function initializeEnhancedModules() {
    try {
      console.log('🚀 初始化增强模块...');

      if (window.DOMEnhancer) {
        callIfFunc(window.DOMEnhancer, 'enableDebugMode');
        callIfFunc(window.DOMEnhancer, 'startAutoEnhancement');
        console.log('🔧 DOM增强器已启动');
      }

      if (window.RealtimeDataManager) {
        callIfFunc(window.RealtimeDataManager, 'enableDebugMode');
        callIfFunc(window.RealtimeDataManager, 'initialize');
        console.log('📊 实时数据管理器已启动');
      }

      if (window.DataSyncManager) {
        callIfFunc(window.DataSyncManager, 'enableDebugMode');
        console.log('🔄 数据同步管理器已启动');
      }

      if (window.DisplayFixer) {
        callIfFunc(window.DisplayFixer, 'enableDebugMode');
        callIfFunc(window.DisplayFixer, 'initialize');
        console.log('🔧 显示修复器已启动');
      }

      setTimeout(() => {
        if (window.DOMEnhancer) {
          callIfFunc(window.DOMEnhancer, 'enhanceAllExistingElements');
          callIfFunc(window.DOMEnhancer, 'fixExistingDataAttributes');
          console.log('🔧 现有元素增强完成');
        }
        if (window.DisplayFixer) {
          callIfFunc(window.DisplayFixer, 'manualFix');
          console.log('🔧 显示问题修复完成');
        }
        if (window.DataSyncManager) {
          callIfFunc(window.DataSyncManager, 'refreshAllVisibleShops');
          console.log('🔄 数据刷新完成');
        }
      }, 1500);
    } catch (e) {
      console.warn('初始化增强模块出错:', e);
    }
  }

  // 消息页增强（事件绑定与快捷功能）
  function initializeMessagePageEnhancements() {
    try {
      const searchInput = document.getElementById('conversationSearch');
      if (searchInput) {
        searchInput.addEventListener('input', window.searchConversations || function(){});
      }

      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const filterType = this.getAttribute('data-filter');
          if (typeof window.filterConversations === 'function') {
            window.filterConversations(filterType);
          }
        });
      });

      const quickReplyBtn = document.getElementById('quickReplyBtn');
      if (quickReplyBtn) {
        quickReplyBtn.addEventListener('click', function() {
          callIfFunc(window, 'toggleQuickReplies');
        });
      }

      document.querySelectorAll('.quick-reply-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          if (typeof window.sendQuickReply === 'function') {
            window.sendQuickReply(this.textContent);
          }
        });
      });

      const emojiBtn = document.getElementById('emojiBtn');
      if (emojiBtn) {
        emojiBtn.addEventListener('click', function() {
          callIfFunc(window, 'showToast', '表情功能开发中...', 'info');
        });
      }

      const mediaBtn = document.getElementById('mediaBtn');
      if (mediaBtn) {
        mediaBtn.addEventListener('click', function() {
          callIfFunc(window, 'showToast', '文件上传功能开发中...', 'info');
        });
      }
    } catch (e) {
      console.warn('initializeMessagePageEnhancements 出错:', e);
    }
  }

  // 更新连接状态（供 WebSocket 使用）
  function updateConnectionStatus(isConnected) {
    try {
      const statusDot = document.getElementById('connectionStatus');
      const statusText = document.getElementById('connectionText');
      if (!statusDot || !statusText) return;
      if (isConnected) {
        statusDot.classList.remove('disconnected');
        statusText.textContent = '已连接';
      } else {
        statusDot.classList.add('disconnected');
        statusText.textContent = '未连接';
      }
    } catch (e) {
      console.warn('updateConnectionStatus 出错:', e);
    }
  }

  // 初始化 WebSocket（委托给 UnifiedWebSocket）
  function initializeWebSocket() {
    try {
      if (window.UnifiedWebSocket) {
        window.UnifiedWebSocket.init({ /* 可通过 init 注入参数 */ }).connect();
        return;
      }
      // 兼容兜底（理论上不会走到）
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      window.websocket = ws;
      ws.onopen = function(){ updateConnectionStatus(true); };
      ws.onclose = function(){ updateConnectionStatus(false); setTimeout(initializeWebSocket, 5000); };
      ws.onerror = function(){ updateConnectionStatus(false); };
      ws.onmessage = function(event){ try { const data = JSON.parse(event.data); if (typeof window.handleWebSocketMessage==='function') window.handleWebSocketMessage(data); } catch(_){} };
    } catch (e) { console.warn('initializeWebSocket 出错:', e); }
  }

  // 应用初始化主流程（带幂等保护）
  async function initializeApp() {
    try {
      if (window.__quicktalk_app_inited) {
        console.log('ℹ️ initializeApp 已执行过，跳过本次调用');
        return;
      }
      window.__quicktalk_app_inited = true;
      // 登录状态
      if (typeof window.checkLoginStatus === 'function') {
        const ok = await window.checkLoginStatus();
        if (!ok) return;
      }

      // 新模块初始化
      initializeEnhancedModules();

      // 优先调用消息页胶水（新）
      if (window.MessagesBootstrap && typeof window.MessagesBootstrap.init === 'function') {
        window.MessagesBootstrap.init();
      } else {
        // 兼容旧实现
        initializeMessagePageEnhancements();
      }

      // 绑定导航事件（由 HTML 内定义的函数实现）
      if (typeof window.bindNavigationEvents === 'function') {
        window.bindNavigationEvents();
      }

      // WebSocket 连接
      initializeWebSocket();

      // 再次增强（与原逻辑保持一致）
      initializeEnhancedModules();

      // 页面状态与首屏数据引导（封装于 PageState）
      if (window.PageState && typeof window.PageState.init === 'function') {
        await window.PageState.init();
      } else {
        // 兼容旧路径：逐一调用
        await callIfFunc(window, 'loadDashboardData');
        callIfFunc(window, 'initializeProfilePage');
        callIfFunc(window, 'initializePageStates');
      }

      console.log('✅ 应用初始化完成');
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      callIfFunc(window, 'showToast', '系统启动失败，请刷新页面重试', 'error');
    }
  }

  // DOMContentLoaded 入口：优先加载局部组件，再启动应用
  function onDOMContentLoaded() {
    if (window.__quicktalk_app_inited) {
      console.log('ℹ️ DOMContentLoaded: 应用已初始化，跳过');
      return;
    }
    console.log('📱 QuickTalk 移动端管理系统启动');
    const loadPartials = () => {
      if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
        return window.PartialsLoader.loadPartials();
      }
      return Promise.resolve();
    };
    Promise.resolve()
      .then(loadPartials)
      .catch(e => console.error('❌ 组件加载失败:', e))
      .finally(() => initializeApp());
  }

  // 暴露到全局，供其他模块调用（保持兼容）
  window.initializeApp = initializeApp;
  window.initializeEnhancedModules = initializeEnhancedModules;
  window.initializeMessagePageEnhancements = initializeMessagePageEnhancements;
  window.initializeWebSocket = initializeWebSocket;
  window.updateConnectionStatus = updateConnectionStatus;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  } else {
    // 若已加载，直接调用
    onDOMContentLoaded();
  }

  console.log('✅ app-init.js 加载完成');
})();
