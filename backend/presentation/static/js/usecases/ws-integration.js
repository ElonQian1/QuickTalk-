/*
 * WebSocket 增强集成桥接 (ws-integration.js)
 * - 集成连接状态 UI、自动重连、心跳保活
 * - 提供 enhanceWebSocket 接口，装饰原生 WebSocket 实例
 */
(function(){
  'use strict';

  function enhanceWebSocket(ws){
    if (!ws) return;

    // 保存原始事件处理器
    var originalOnOpen = ws.onopen;
    var originalOnClose = ws.onclose;
    var originalOnError = ws.onerror;
    var originalOnMessage = ws.onmessage;

    // 装饰 onopen
    ws.onopen = function(event){
      console.log('WebSocket 已连接');
      
      // 显示连接成功状态
      if (window.ConnectionIndicatorUI && typeof window.ConnectionIndicatorUI.showConnected === 'function') {
        window.ConnectionIndicatorUI.showConnected('连接成功');
      }
      
      // 重置重连计数
      if (window.WSReconnect && typeof window.WSReconnect.onConnected === 'function') {
        window.WSReconnect.onConnected();
      }
      
      // 启动心跳
      if (window.WSHeartbeat && typeof window.WSHeartbeat.start === 'function') {
        window.WSHeartbeat.start();
      }
      
      // 调用原始处理器
      if (originalOnOpen) originalOnOpen.call(ws, event);
    };

    // 装饰 onclose
    ws.onclose = function(event){
      console.log('WebSocket 已断开', event);
      
      // 显示断开状态
      if (window.ConnectionIndicatorUI && typeof window.ConnectionIndicatorUI.showDisconnected === 'function') {
        window.ConnectionIndicatorUI.showDisconnected('连接已断开');
      }
      
      // 停止心跳
      if (window.WSHeartbeat && typeof window.WSHeartbeat.stop === 'function') {
        window.WSHeartbeat.stop();
      }
      
      // 触发自动重连
      if (window.WSReconnect && typeof window.WSReconnect.onDisconnected === 'function') {
        window.WSReconnect.onDisconnected();
      }
      
      // 调用原始处理器
      if (originalOnClose) originalOnClose.call(ws, event);
    };

    // 装饰 onerror
    ws.onerror = function(event){
      console.error('WebSocket 错误', event);
      
      // 显示错误状态
      if (window.ConnectionIndicatorUI && typeof window.ConnectionIndicatorUI.showDisconnected === 'function') {
        window.ConnectionIndicatorUI.showDisconnected('连接出错');
      }
      
      // 调用原始处理器
      if (originalOnError) originalOnError.call(ws, event);
    };

    // 装饰 onmessage
    ws.onmessage = function(event){
      try {
        var data = JSON.parse(event.data);
        
        // 处理 pong 响应
        if (data.type === 'pong') {
          if (window.WSHeartbeat && typeof window.WSHeartbeat.onPong === 'function') {
            window.WSHeartbeat.onPong();
          }
          return; // pong 不需要传递给业务层
        }
      } catch(e){
        // JSON 解析失败，继续传递给原始处理器
      }
      
      // 调用原始处理器
      if (originalOnMessage) originalOnMessage.call(ws, event);
    };

    console.log('✅ WebSocket 已增强（连接状态/重连/心跳）');
  }

  // 监听全局 WebSocket 创建事件（如果有）
  function autoEnhance(){
    // 定期检查 window.ws 是否已创建
    var checkTimer = setInterval(function(){
      if (window.ws && window.ws instanceof WebSocket && !window.ws.__enhanced) {
        enhanceWebSocket(window.ws);
        window.ws.__enhanced = true;
        clearInterval(checkTimer);
      }
    }, 100);
    
    // 10 秒后停止检查
    setTimeout(function(){ clearInterval(checkTimer); }, 10000);
  }

  window.WSIntegration = {
    enhanceWebSocket: enhanceWebSocket,
    autoEnhance: autoEnhance
  };

  // 自动启动增强检查
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoEnhance);
  } else {
    autoEnhance();
  }

  console.log('✅ ws-integration 已加载');
})();
