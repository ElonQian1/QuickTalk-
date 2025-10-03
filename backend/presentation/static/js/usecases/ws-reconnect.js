/*
 * WebSocket 自动重连用例 (ws-reconnect.js)
 * - 断线自动重连机制（指数退避、最大重试次数）
 * - 提供 enable/disable/reconnect 接口
 */
(function(){
  'use strict';

  var config = {
    enabled: true,
    maxRetries: 5,
    baseDelay: 1000, // 初始延迟 1 秒
    maxDelay: 30000, // 最大延迟 30 秒
    retryCount: 0,
    reconnectTimer: null
  };

  function calculateDelay(){
    // 指数退避：1s, 2s, 4s, 8s, 16s, 30s(max)
    var delay = Math.min(config.baseDelay * Math.pow(2, config.retryCount), config.maxDelay);
    return delay;
  }

  function reconnect(){
    if (!config.enabled) return;
    if (config.retryCount >= config.maxRetries) {
      console.warn('已达到最大重连次数，停止重连');
      if (window.ConnectionIndicatorUI && typeof window.ConnectionIndicatorUI.showDisconnected === 'function') {
        window.ConnectionIndicatorUI.showDisconnected('连接失败，请刷新页面重试');
      }
      if (window.showToast) window.showToast('连接失败，请刷新页面', 'error');
      return;
    }

    var delay = calculateDelay();
    config.retryCount++;
    console.log('将在 ' + (delay/1000) + ' 秒后尝试第 ' + config.retryCount + ' 次重连...');
    
    if (window.ConnectionIndicatorUI && typeof window.ConnectionIndicatorUI.showReconnecting === 'function') {
      window.ConnectionIndicatorUI.showReconnecting('正在重连... (尝试 ' + config.retryCount + '/' + config.maxRetries + ')');
    }

    config.reconnectTimer = setTimeout(function(){
      // 调用全局 WebSocket 初始化函数
      if (window.initWebSocket && typeof window.initWebSocket === 'function') {
        console.log('执行重连...');
        window.initWebSocket();
      } else if (window.messageModule && typeof window.messageModule.initWebSocket === 'function') {
        window.messageModule.initWebSocket();
      } else {
        console.error('未找到 WebSocket 初始化函数');
      }
    }, delay);
  }

  function reset(){
    config.retryCount = 0;
    if (config.reconnectTimer) {
      clearTimeout(config.reconnectTimer);
      config.reconnectTimer = null;
    }
  }

  function onConnected(){
    reset();
    console.log('WebSocket 已连接，重置重连计数');
  }

  function onDisconnected(){
    if (!config.enabled) return;
    console.log('WebSocket 已断开，准备重连...');
    reconnect();
  }

  function enable(){
    config.enabled = true;
  }

  function disable(){
    config.enabled = false;
    reset();
  }

  function setConfig(options){
    if (options.maxRetries !== undefined) config.maxRetries = options.maxRetries;
    if (options.baseDelay !== undefined) config.baseDelay = options.baseDelay;
    if (options.maxDelay !== undefined) config.maxDelay = options.maxDelay;
  }

  window.WSReconnect = {
    reconnect: reconnect,
    reset: reset,
    onConnected: onConnected,
    onDisconnected: onDisconnected,
    enable: enable,
    disable: disable,
    setConfig: setConfig
  };
  console.log('✅ ws-reconnect 用例已加载');
})();
