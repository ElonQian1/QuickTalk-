/*
 * WebSocket 心跳保活用例 (ws-heartbeat.js)
 * - 定时发送 ping，超时检测，触发重连
 * - 提供 start/stop/ping 接口
 */
(function(){
  'use strict';

  var config = {
    enabled: true,
    interval: 30000, // 30秒发一次 ping
    timeout: 10000,  // 10秒未收到 pong 视为超时
    pingTimer: null,
    pongTimer: null,
    lastPongAt: Date.now()
  };

  function ping(){
    if (!config.enabled) return;
    if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，跳过心跳');
      return;
    }
    
    try {
      window.ws.send(JSON.stringify({ type: 'ping' }));
      console.log('发送心跳 ping');
      
      // 启动 pong 超时检测
      config.pongTimer = setTimeout(function(){
        console.warn('心跳 pong 超时，触发重连');
        if (window.WSReconnect && typeof window.WSReconnect.onDisconnected === 'function') {
          window.WSReconnect.onDisconnected();
        }
      }, config.timeout);
    } catch(err){
      console.error('发送心跳失败', err);
    }
  }

  function onPong(){
    config.lastPongAt = Date.now();
    if (config.pongTimer) {
      clearTimeout(config.pongTimer);
      config.pongTimer = null;
    }
    console.log('收到心跳 pong');
  }

  function start(){
    if (!config.enabled) return;
    stop(); // 先停止之前的计时器
    config.pingTimer = setInterval(ping, config.interval);
    console.log('心跳已启动，间隔 ' + (config.interval/1000) + ' 秒');
  }

  function stop(){
    if (config.pingTimer) {
      clearInterval(config.pingTimer);
      config.pingTimer = null;
    }
    if (config.pongTimer) {
      clearTimeout(config.pongTimer);
      config.pongTimer = null;
    }
    console.log('心跳已停止');
  }

  function enable(){
    config.enabled = true;
  }

  function disable(){
    config.enabled = false;
    stop();
  }

  function setConfig(options){
    if (options.interval !== undefined) config.interval = options.interval;
    if (options.timeout !== undefined) config.timeout = options.timeout;
  }

  window.WSHeartbeat = {
    ping: ping,
    onPong: onPong,
    start: start,
    stop: stop,
    enable: enable,
    disable: disable,
    setConfig: setConfig
  };
  console.log('✅ ws-heartbeat 用例已加载');
})();
