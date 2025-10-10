/* 简化版嵌入式客服 - 智能自适应地址检测 v1.3.0 */
(function(){
  // 版本信息
  var CLIENT_VERSION = '1.3.2'; // 修复消息发送和文件上传功能
  var UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟检查一次
  
  // 缓存服务器配置
  var SERVER_CONFIG_CACHE = null;
  var CONFIG_CACHE_TIME = 10 * 60 * 1000; // 10分钟缓存
  var LAST_CONFIG_FETCH = 0;
  
  // 智能服务器地址检测
  function detectServerUrl() {
    var currentUrl = window.location;
    var candidates = [
      // 优先尝试当前域名的标准端口
      currentUrl.protocol + '//' + currentUrl.hostname + ':8080',
      // 如果是HTTPS，也尝试8080端口
      currentUrl.protocol + '//' + currentUrl.hostname + ':8080',
      // 尝试相同协议和端口
      currentUrl.protocol + '//' + currentUrl.host,
      // 开发环境后备选项
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];
    
    // 去重
    var uniqueCandidates = [];
    candidates.forEach(function(url) {
      if (uniqueCandidates.indexOf(url) === -1) {
        uniqueCandidates.push(url);
      }
    });
    
    return uniqueCandidates;
  }
  
  // 异步检测可用的服务器地址
  function findAvailableServer(onSuccess, onError) {
    var candidates = detectServerUrl();
    var tested = 0;
    var errors = [];
    
    function testServer(url, callback) {
      fetch(url + '/api/config', {
        method: 'GET',
        mode: 'cors',
        timeout: 5000
      })
      .then(function(response) {
        if (response.ok) {
          return response.json();
        }
        throw new Error('HTTP ' + response.status);
      })
      .then(function(config) {
        // 成功获取配置，缓存结果
        SERVER_CONFIG_CACHE = config;
        LAST_CONFIG_FETCH = Date.now();
        callback(null, config);
      })
      .catch(function(error) {
        callback(error, null);
      });
    }
    
    function tryNext() {
      if (tested >= candidates.length) {
        onError('所有服务器候选地址都无法连接: ' + errors.join(', '));
        return;
      }
      
      var url = candidates[tested];
      tested++;
      
      testServer(url, function(error, config) {
        if (error) {
          errors.push(url + ': ' + error.message);
          setTimeout(tryNext, 100); // 短暂延迟后尝试下一个
        } else {
          onSuccess(config);
        }
      });
    }
    
    // 检查缓存
    if (SERVER_CONFIG_CACHE && (Date.now() - LAST_CONFIG_FETCH) < CONFIG_CACHE_TIME) {
      setTimeout(function() { onSuccess(SERVER_CONFIG_CACHE); }, 0);
      return;
    }
    
    tryNext();
  }
  
  // 版本检测和自动更新
  function checkForUpdates(serverUrl) {
    if (!serverUrl) return;
    
    fetch(serverUrl + '/api/sdk/version')
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.version && data.version !== CLIENT_VERSION) {
          console.log('🔄 检测到新版本:', data.version, '当前版本:', CLIENT_VERSION);
          // 可以在这里添加通知用户更新的逻辑
        }
      })
      .catch(function() {
        // 忽略版本检查错误
      });
  }

  // 工具函数
  function onReady(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // 智能客服客户端 - 支持自动服务器检测
  function createChatClient(config) {
    var shopId = config.shopId;
    var customerId = 'guest-' + Math.random().toString(36).slice(2);
    var ws = null;
    var eventHandlers = {};
    var serverConfig = null;
    var isConnecting = false;
    
    return {
      shopId: shopId,
      sessionId: customerId,
      serverConfig: null,
      
      // 智能连接 - 自动检测服务器地址
      connect: function() {
        if (isConnecting) return;
        isConnecting = true;
        
        var self = this;
        
        // 如果用户指定了服务器地址，直接使用
        if (config.serverUrl) {
          self.serverConfig = { serverUrl: config.serverUrl };
          connectWithConfig(self.serverConfig);
          return;
        }
        
        // 智能检测可用服务器
        findAvailableServer(
          function(detectedConfig) {
            self.serverConfig = detectedConfig;
            connectWithConfig(detectedConfig);
          },
          function(error) {
            console.error('❌ 无法检测到可用的服务器:', error);
            emit('error', new Error('服务器连接失败: ' + error));
            isConnecting = false;
          }
        );
        
        function connectWithConfig(config) {
          // 保存服务器配置到客户端实例
          self.serverConfig = config;
          
          // 构建 WebSocket URL，优先使用 endpoints.websocket.customer
          var wsUrl;
          if (config.endpoints && config.endpoints.websocket && config.endpoints.websocket.customer) {
            wsUrl = config.endpoints.websocket.customer + '/' + shopId + '/' + customerId;
          } else if (config.wsUrl) {
            wsUrl = config.wsUrl + '/ws/customer/' + shopId + '/' + customerId;
          } else {
            // 兜底方案：从 serverUrl 构建
            var serverUrl = config.serverUrl || config.server_url || '';
            var wsProtocol = serverUrl.indexOf('https') === 0 ? 'wss' : 'ws';
            var wsBase = serverUrl.replace(/^https?/, wsProtocol);
            wsUrl = wsBase + '/ws/customer/' + shopId + '/' + customerId;
          }
          
          console.log('🔗 连接到WebSocket:', wsUrl);
          
          ws = new WebSocket(wsUrl);
          
          ws.onopen = function() {
            console.log('✅ WebSocket连接成功');
            ws.send(JSON.stringify({
              messageType: 'auth',
              metadata: { apiKey: shopId, customerId: customerId }
            }));
            emit('connected', { serverConfig: config });
            isConnecting = false;
            
            // 定期检查更新
            checkForUpdates(config.serverUrl);
          };
          
          ws.onmessage = function(event) {
            var message = JSON.parse(event.data);
            if (message.messageType === 'new_message') {
              emit('message', message);
            }
          };
          
          ws.onclose = function() {
            console.log('🔌 WebSocket连接关闭');
            emit('disconnected');
            isConnecting = false;
          };
          
          ws.onerror = function(error) {
            console.error('❌ WebSocket错误:', error);
            emit('error', error);
            isConnecting = false;
          };
        }
      },

      sendMessage: function(content, messageType, mediaUrl) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          var messageData = {
            messageType: 'send_message',
            content: content,
            senderType: 'customer',
            metadata: { messageType: messageType || 'text' }
          };
          
          // 如果有媒体URL，添加到metadata中
          if (mediaUrl) {
            messageData.metadata.mediaUrl = mediaUrl;
          }
          
          ws.send(JSON.stringify(messageData));
        } else {
          console.warn('⚠️ WebSocket未连接，无法发送消息');
        }
      },

      uploadFile: function(file, messageType) {
        var self = this;
        return new Promise(function(resolve, reject) {
          if (!self.serverConfig) {
            reject(new Error('服务器配置未加载'));
            return;
          }
          
          var formData = new FormData();
          formData.append('file', file);
          formData.append('shopId', shopId);
          formData.append('messageType', messageType || 'file');
          formData.append('customerCode', customerId);

          // 构建上传URL，优先使用配置的端点，否则使用兜底方案
          var uploadUrl;
          if (self.serverConfig.endpoints && self.serverConfig.endpoints.upload) {
            uploadUrl = self.serverConfig.endpoints.upload;
          } else {
            uploadUrl = self.serverConfig.serverUrl + '/api/customer/upload';
          }

          fetch(uploadUrl, {
            method: 'POST',
            body: formData
          })
          .then(function(response) {
            if (!response.ok) throw new Error('Upload failed');
            return response.json();
          })
          .then(function(data) {
            // 自动发送消息
            self.sendMessage(data.url, messageType, data.url);
            resolve(data);
          })
          .catch(reject);
        });
      },

      // 获取当前服务器信息
      getServerInfo: function() {
        return this.serverConfig || null;
      },

      // 手动重新检测服务器
      reconnect: function() {
        if (ws) {
          ws.close();
        }
        SERVER_CONFIG_CACHE = null; // 清除缓存
        this.connect();
      },

      on: function(event, handler) {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
      }
    };

    function emit(event, data) {
      if (eventHandlers[event]) {
        eventHandlers[event].forEach(function(handler) {
          try { handler(data); } catch(e) { console.error(e); }
        });
      }
    }
  }

  // 动态视口检测和自适应管理器
  function ViewportManager() {
    var currentBreakpoint = '';
    var listeners = [];
    
    // 定义断点
    var breakpoints = {
      'ultra-small': 360,
      'small': 480,
      'medium': 768,
      'large': 1024,
      'extra-large': 1200
    };
    
    function detectBreakpoint() {
      var width = window.innerWidth;
      var height = window.innerHeight;
      var screenWidth = window.screen ? window.screen.width : width;
      var screenHeight = window.screen ? window.screen.height : height;
      var dpr = window.devicePixelRatio || 1;
      
      // 获取真实的物理尺寸
      var physicalWidth = width * dpr;
      var physicalHeight = height * dpr;
      
      var isLandscape = width > height;
      
      // 更准确的移动设备检测
      var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      var isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // 修正异常高度检测（开发者工具模拟器可能导致）
      var normalizedHeight = height;
      if (height > 1500 && width < 500) {
        // 可能是开发者工具模拟器异常，使用合理的比例
        normalizedHeight = Math.floor(width * 2.1); // 典型手机比例 (~9:21)
        console.log('🔧 检测到异常视口高度，自动修正:', height + ' -> ' + normalizedHeight);
      }
      
      // 智能移动设备判断
      var isMobileScreen = width <= breakpoints['medium']; // <= 768px
      var isRealMobile = isMobileUA || (isTouchDevice && width <= 480) || (screenWidth <= 480);
      
      // 综合判断是否为移动设备
      var isMobile = isRealMobile || (isTouchDevice && isMobileScreen);
      
      // 修正断点检测逻辑 - 考虑真实设备特征
      var breakpoint;
      if (width <= breakpoints['ultra-small']) { // <= 360
        breakpoint = 'ultra-small';
      } else if (width <= breakpoints['small']) { // <= 480  
        breakpoint = 'small';
      } else if (width <= breakpoints['medium']) { // <= 768
        breakpoint = 'medium';
      } else if (width <= breakpoints['large']) { // <= 1024
        breakpoint = 'large';
      } else { // > 1024
        breakpoint = 'extra-large';
      }
      
      // 对于移动设备，强制使用移动断点且更精确判断
      if (isMobileUA) {
        if (width <= 360) {
          breakpoint = 'ultra-small';
        } else if (width <= 480) {
          breakpoint = 'small';
        } else if (width <= 768) {
          breakpoint = 'medium';
        }
      }
      
      return {
        breakpoint: breakpoint,
        width: width,
        height: normalizedHeight,
        originalHeight: height,
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        physicalWidth: physicalWidth,
        physicalHeight: physicalHeight,
        isLandscape: isLandscape,
        isMobile: isMobile,
        isRealMobile: isRealMobile,
        isTouch: isTouchDevice,
        isMobileUA: isMobileUA,
        actualDevicePixelRatio: dpr
      };
    }
    
    function notifyChange(viewport) {
      listeners.forEach(function(listener) {
        try {
          listener(viewport);
        } catch(e) {
          console.error('视口变化监听器错误:', e);
        }
      });
    }
    
    var lastViewportUpdate = 0;
    var stableViewport = null;
    var viewportChangeCount = 0;
    var forceStableMode = false; // 新增强制稳定标志
    
    function updateViewport() {
      var now = Date.now();
      var viewport = detectBreakpoint();
      
      // 如果已经进入强制稳定模式且检测到移动设备，保持稳定
      if (forceStableMode && (viewport.isMobileUA || viewport.isRealMobile)) {
        return stableViewport || viewport;
      }
      
      // 检测是否在快速切换中
      if (now - lastViewportUpdate < 100) {
        viewportChangeCount++;
      } else {
        viewportChangeCount = 0;
      }
      lastViewportUpdate = now;
      
      // 如果检测到快速切换，优先使用移动端UA或真实移动设备判断
      if (viewportChangeCount > 1 && (viewport.isMobileUA || viewport.isRealMobile)) {
        console.log('🚨 检测到快速视口切换，启用强制稳定模式');
        forceStableMode = true;
        
        // 根据实际宽度更精确地设置断点
        var stableBreakpoint;
        if (viewport.width <= 360) {
          stableBreakpoint = 'ultra-small';
        } else if (viewport.width <= 480) {
          stableBreakpoint = 'small';
        } else if (viewport.width <= 768) {
          stableBreakpoint = 'medium';
        } else {
          // 对于高分辨率移动设备，根据DPR调整
          stableBreakpoint = viewport.actualDevicePixelRatio >= 2 ? 'medium' : 'large';
        }
        
        viewport = {
          ...viewport,
          breakpoint: stableBreakpoint,
          isMobile: true,
          forceStable: true
        };
        viewportChangeCount = 0; // 重置计数器
      }
      
      var breakpointChanged = viewport.breakpoint !== currentBreakpoint;
      
      // 稳定性检查：如果是相同的断点且在短时间内，跳过更新
      if (stableViewport && 
          viewport.breakpoint === stableViewport.breakpoint && 
          now - lastViewportUpdate < 200 && 
          !viewport.forceStable &&
          !forceStableMode) {
        return stableViewport;
      }
      
      if (breakpointChanged || viewport.forceStable) {
        currentBreakpoint = viewport.breakpoint;
        stableViewport = viewport;
        
        console.log('📱 动态视口适配:', 
          viewport.breakpoint, 
          '📏 ' + viewport.width + 'x' + viewport.height + 
          (viewport.originalHeight !== viewport.height ? ' (修正自' + viewport.originalHeight + ')' : ''),
          viewport.isRealMobile ? '(真实移动端)' : viewport.isMobile ? '(移动端)' : '(桌面端)', 
          viewport.isTouch ? '(触摸)' : '(鼠标)',
          viewport.isLandscape ? '(横屏)' : '(竖屏)',
          viewport.isMobileUA ? '[UA检测:移动]' : '[UA检测:桌面]',
          'DPR:' + viewport.actualDevicePixelRatio,
          '物理:' + Math.round(viewport.physicalWidth) + 'x' + Math.round(viewport.physicalHeight),
          viewport.forceStable ? '[强制稳定]' : '',
          forceStableMode ? '[稳定模式]' : '');
        
        // 延迟通知，避免连续触发
        setTimeout(function() {
          notifyChange(viewport);
        }, 50);
      }
      
      return viewport;
    }
    
    // 初始检测 - 优化稳定性
    console.log('🔧 启动初始视口检测...');
    
    // 立即检测一次
    var initialViewport = updateViewport();
    
    // 如果检测到移动设备UA或真实移动设备，立即强制稳定
    if (initialViewport && (initialViewport.isMobileUA || initialViewport.isRealMobile)) {
      console.log('🎯 检测到移动设备，强制稳定模式');
      
      // 根据实际宽度和设备特征更精确地设置断点
      var stableBreakpoint;
      if (initialViewport.width <= 360) {
        stableBreakpoint = 'ultra-small';
      } else if (initialViewport.width <= 480) {
        stableBreakpoint = 'small';
      } else if (initialViewport.width <= 768) {
        stableBreakpoint = 'medium';
      } else {
        // 对于高分辨率移动设备（如iPhone Pro Max），考虑DPR
        stableBreakpoint = initialViewport.actualDevicePixelRatio >= 2 ? 'medium' : 'large';
      }
      
      var forcedViewport = {
        ...initialViewport,
        breakpoint: stableBreakpoint,
        isMobile: true,
        forceStable: true
      };
      stableViewport = forcedViewport;
      currentBreakpoint = forcedViewport.breakpoint;
      
      setTimeout(function() {
        notifyChange(forcedViewport);
      }, 100);
    } else {
      // 非移动设备的延迟稳定检测
      setTimeout(function() {
        console.log('🔄 执行稳定性检测...');
        updateViewport();
      }, 400);
    }
    
    // 监听窗口大小变化 - 增加防抖延迟
    var resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        console.log('🔄 窗口大小变化触发检测');
        updateViewport();
      }, 300); // 增加延迟到300ms
    });
    
    // 监听方向变化 - 增加延迟
    window.addEventListener('orientationchange', function() {
      console.log('🔄 屏幕方向变化触发检测');
      setTimeout(function() {
        updateViewport();
      }, 800); // 增加延迟到800ms
    });
    
    // 监听页面可见性变化，避免后台切换导致的问题
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        console.log('🔄 页面重新可见，重新检测视口');
        setTimeout(updateViewport, 500);
      }
    });
    
    return {
      getCurrentViewport: function() {
        return detectBreakpoint();
      },
      onViewportChange: function(callback) {
        listeners.push(callback);
      },
      removeViewportListener: function(callback) {
        var index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  function createUI() {
    if (document.getElementById('qt-fab')) {
      return {
        btn: document.getElementById('qt-fab'),
        panel: document.getElementById('qt-panel'),
        closeBtn: document.querySelector('.qt-close-btn')
      };
    }

    // 初始化视口管理器
    var viewportManager = ViewportManager();
    
    // 添加调试信息
    console.log('🔧 动态视口适配系统已启动');
    var initialViewport = viewportManager.getCurrentViewport();
    console.log('📊 初始视口状态:', initialViewport.breakpoint, initialViewport.width + 'x' + initialViewport.height);
    console.log('🔍 设备信息详情:', {
      userAgent: navigator.userAgent,
      isMobileUA: initialViewport.isMobileUA,
      isTouch: initialViewport.isTouch,
      devicePixelRatio: initialViewport.actualDevicePixelRatio,
      screenSize: screen.width + 'x' + screen.height,
      availableSize: screen.availWidth + 'x' + screen.availHeight,
      innerSize: window.innerWidth + 'x' + window.innerHeight,
      outerSize: window.outerWidth + 'x' + window.outerHeight,
      viewport: '📏 ' + initialViewport.width + 'x' + initialViewport.height + ' → ' + initialViewport.breakpoint,
      orientation: window.orientation !== undefined ? window.orientation + '°' : 'unknown'
    });
    
    // 检查并加载 CSS 样式
    var cssId = 'qt-customer-service-styles';
    if (!document.getElementById(cssId)) {
      var cssLink = document.createElement('link');
      cssLink.id = cssId;
      cssLink.rel = 'stylesheet';
      cssLink.type = 'text/css';
      
      // 智能检测CSS路径
      var currentUrl = window.location;
      var cssUrl = currentUrl.protocol + '//' + currentUrl.host + '/static/embed/styles.css';
      
      cssLink.href = cssUrl;
      document.head.appendChild(cssLink);
    }

    var btn = document.createElement('div');
    btn.id = 'qt-fab';
    btn.className = 'qt-fab';
    btn.textContent = '客服';

    var panel = document.createElement('div');
    panel.id = 'qt-panel';
    panel.className = 'qt-panel';
    panel.innerHTML = '<div class="qt-header">💬 在线客服</div><div class="qt-body"></div><div class="qt-input"><button class="qt-image-btn" title="发送图片">📷</button><button class="qt-file-btn" title="发送文件">📎</button><button class="qt-voice-btn" title="发送语音">🎤</button><input type="text" placeholder="输入消息..." autocomplete="off"/><button class="qt-send-btn">发送</button><input type="file" class="qt-image-input" accept="image/*" style="display:none"/><input type="file" class="qt-file-input" style="display:none"/></div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    
    // 添加关闭按钮（移动端友好）
    var closeBtn = document.createElement('button');
    closeBtn.className = 'qt-close-btn';
    closeBtn.innerHTML = '×';
    panel.querySelector('.qt-header').appendChild(closeBtn);
    
    // 创建统一的样式系统
    function createUnifiedStyleSystem() {
      // 移除旧的样式标签
      var oldStyle = document.getElementById('qt-responsive-styles');
      if (oldStyle) {
        oldStyle.remove();
      }
      
      var styleElement = document.createElement('style');
      styleElement.id = 'qt-responsive-styles';
      styleElement.textContent = `
        /* QuickTalk 完全独立的样式系统 - 防止外部样式干扰 */
        
        /* 重置所有QuickTalk元素的样式 */
        #qt-fab, #qt-panel, #qt-panel *, 
        .qt-fab, .qt-panel, .qt-panel * {
          all: initial !important;
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        
        /* 基础动画定义 */
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      
      document.head.appendChild(styleElement);
      return styleElement;
    }
    
    // 响应式样式计算函数
    function calculateResponsiveStyles(viewport) {
      var vw = viewport.width;
      var vh = viewport.height;
      var dpr = viewport.actualDevicePixelRatio || 1;
      var isMobile = viewport.isRealMobile || viewport.isMobileUA;
      
      // 基准字体大小计算
      var baseFontSize;
      if (isMobile) {
        if (vw <= 360) {
          baseFontSize = Math.max(28, vw / 9);        // 28-40px
        } else if (vw <= 480) {
          baseFontSize = Math.max(32, vw / 11);       // 32-44px  
        } else if (vw <= 768) {
          baseFontSize = Math.max(36, vw / 13);       // 36-59px
        } else {
          baseFontSize = Math.max(40, vw / 15);       // 40-67px
        }
        
        // 高DPR设备调整
        if (dpr >= 3) baseFontSize *= 1.05;
      } else {
        baseFontSize = 16; // 桌面端固定
      }
      
      // 计算衍生尺寸
      return {
        baseFontSize: Math.round(baseFontSize),
        titleSize: Math.round(baseFontSize * 1.15),
        inputSize: Math.round(baseFontSize * 1.1),
        buttonSize: Math.round(baseFontSize * 1.05),
        messageSize: Math.round(baseFontSize * 1.05),
        fabSize: Math.round(baseFontSize * 2.8),
        fabFontSize: Math.round(baseFontSize * 1.6),
        
        spacing: {
          xs: Math.round(baseFontSize * 0.3),
          sm: Math.round(baseFontSize * 0.5),
          md: Math.round(baseFontSize * 0.75),
          lg: Math.round(baseFontSize * 1),
          xl: Math.round(baseFontSize * 1.25)
        },
        
        borderRadius: Math.round(baseFontSize * 0.5),
        buttonHeight: Math.round(baseFontSize * 2.5),
        inputHeight: Math.round(baseFontSize * 2.5),
        
        panelWidth: isMobile ? (vw - Math.round(baseFontSize * 1.5)) : 400,
        panelHeight: isMobile ? Math.min(vh * 0.75, vh - 80) : 600,
        panelMargin: isMobile ? Math.round(baseFontSize * 0.75) : 20
      };
    }
    
    // 动态适配函数 - 完全重构
    function adaptToViewport(viewport) {
      console.log('🎨 开始自适应样式系统:', viewport.breakpoint);
      
      var styles = calculateResponsiveStyles(viewport);
      var isMobile = viewport.isRealMobile || viewport.isMobileUA;
      
      // 获取或创建样式元素
      var styleElement = document.getElementById('qt-responsive-styles') || createUnifiedStyleSystem();
      
      // 生成完整的响应式CSS
      var css = `
        /* QuickTalk 完全独立的样式系统 - 防止外部样式干扰 */
        
        /* 重置所有QuickTalk元素的样式 */
        #qt-fab, #qt-panel, #qt-panel *, 
        .qt-fab, .qt-panel, .qt-panel * {
          all: initial !important;
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        
        /* FAB 按钮样式 */
        #qt-fab {
          position: fixed !important;
          z-index: 2147483646 !important;
          right: ${styles.panelMargin}px !important;
          bottom: ${styles.panelMargin + styles.panelHeight + styles.spacing.lg}px !important;
          width: ${styles.fabSize}px !important;
          height: ${styles.fabSize}px !important;
          
          background: #07C160 !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 50% !important;
          font-size: ${styles.fabFontSize}px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          
          box-shadow: 0 8px 32px rgba(7,193,96,0.3) !important;
          transition: all 0.3s ease !important;
          animation: fadeIn 0.5s ease !important;
        }
        
        #qt-fab:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 12px 40px rgba(7,193,96,0.4) !important;
        }
        
        /* 面板样式 */
        #qt-panel {
          position: fixed !important;
          z-index: 2147483647 !important;
          ${isMobile ? `
          left: ${styles.panelMargin}px !important;
          right: ${styles.panelMargin}px !important;
          ` : `
          right: ${styles.panelMargin}px !important;
          width: ${styles.panelWidth}px !important;
          `}
          bottom: ${styles.panelMargin}px !important;
          height: ${styles.panelHeight}px !important;
          
          background: #1f2937 !important;
          color: #f9fafb !important;
          border-radius: ${styles.borderRadius}px !important;
          box-shadow: 0 20px 60px -15px rgba(15,23,42,.4) !important;
          
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          
          font-size: ${styles.baseFontSize}px !important;
          line-height: 1.5 !important;
          
          animation: slideInUp 0.3s ease !important;
          transition: all 0.3s ease !important;
        }
        
        /* 头部样式 */
        #qt-panel .qt-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: ${styles.spacing.lg}px ${styles.spacing.xl}px !important;
          background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
          color: #ffffff !important;
          font-size: ${styles.titleSize}px !important;
          font-weight: 600 !important;
          border-radius: ${styles.borderRadius}px ${styles.borderRadius}px 0 0 !important;
          flex-shrink: 0 !important;
        }
        
        /* 关闭按钮 */
        #qt-panel .qt-close-btn {
          background: rgba(255,255,255,0.2) !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 50% !important;
          width: ${styles.buttonHeight}px !important;
          height: ${styles.buttonHeight}px !important;
          font-size: ${styles.buttonSize}px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: background 0.2s ease !important;
        }
        
        #qt-panel .qt-close-btn:hover {
          background: rgba(255,255,255,0.3) !important;
        }
        
        /* 主体区域 */
        #qt-panel .qt-body {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        
        /* 消息区域 */
        #qt-panel .qt-messages {
          flex: 1 !important;
          padding: ${styles.spacing.lg}px !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          font-size: ${styles.messageSize}px !important;
          line-height: 1.6 !important;
        }
        
        /* 输入区域 */
        #qt-panel .qt-input {
          display: flex !important;
          gap: ${styles.spacing.sm}px !important;
          padding: ${styles.spacing.lg}px !important;
          background: rgba(0,0,0,0.1) !important;
          border-radius: 0 0 ${styles.borderRadius}px ${styles.borderRadius}px !important;
          flex-shrink: 0 !important;
        }
        
        /* 输入框 */
        #qt-panel .qt-input input[type="text"] {
          flex: 1 !important;
          padding: ${styles.spacing.md}px ${styles.spacing.lg}px !important;
          font-size: ${styles.inputSize}px !important;
          height: ${styles.inputHeight}px !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          border-radius: ${styles.borderRadius}px !important;
          background: rgba(255,255,255,0.1) !important;
          color: #ffffff !important;
          outline: none !important;
        }
        
        #qt-panel .qt-input input[type="text"]::placeholder {
          color: rgba(255,255,255,0.6) !important;
        }
        
        #qt-panel .qt-input input[type="text"]:focus {
          border-color: #07C160 !important;
          background: rgba(255,255,255,0.15) !important;
        }
        
        /* 按钮样式 */
        #qt-panel .qt-input button {
          padding: ${styles.spacing.md}px ${styles.spacing.lg}px !important;
          font-size: ${styles.buttonSize}px !important;
          height: ${styles.buttonHeight}px !important;
          min-width: ${styles.buttonHeight}px !important;
          border: none !important;
          border-radius: ${styles.borderRadius}px !important;
          background: rgba(255,255,255,0.2) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        
        #qt-panel .qt-input button:hover {
          background: rgba(255,255,255,0.3) !important;
          transform: scale(1.02) !important;
        }
        
        /* 发送按钮特殊样式 */
        #qt-panel .qt-send-btn {
          background: #07C160 !important;
          color: #ffffff !important;
          font-weight: 600 !important;
          min-width: ${styles.buttonHeight * 1.5}px !important;
        }
        
        #qt-panel .qt-send-btn:hover {
          background: #06A94D !important;
        }
        
        /* 隐藏文件输入 */
        #qt-panel .qt-image-input,
        #qt-panel .qt-file-input {
          display: none !important;
        }
        
        /* 消息样式 */
        #qt-panel .qt-message,
        #qt-panel .message {
          margin-bottom: ${styles.spacing.md}px !important;
          padding: ${styles.spacing.md}px ${styles.spacing.lg}px !important;
          border-radius: ${styles.borderRadius}px !important;
          font-size: ${styles.messageSize}px !important;
          line-height: 1.6 !important;
          max-width: 85% !important;
          word-wrap: break-word !important;
        }
        
        /* 响应式媒体查询 */
        @media (max-width: 768px) {
          #qt-panel {
            left: ${Math.max(8, styles.panelMargin / 2)}px !important;
            right: ${Math.max(8, styles.panelMargin / 2)}px !important;
          }
          
          #qt-fab {
            right: ${Math.max(8, styles.panelMargin / 2)}px !important;
          }
        }
        
        /* 动画定义 */
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      
      // 应用样式
      styleElement.textContent = css;
      
      console.log('✅ 统一样式系统已应用');
      console.log('📏 样式详情:', {
        设备类型: isMobile ? '移动端' : '桌面端',
        基础字体: styles.baseFontSize + 'px',
        标题字体: styles.titleSize + 'px',
        输入框字体: styles.inputSize + 'px',
        FAB尺寸: styles.fabSize + 'px',
        面板尺寸: styles.panelWidth + 'x' + styles.panelHeight + 'px',
        断点: viewport.breakpoint,
        视口: viewport.width + 'x' + viewport.height
      });
    }
    
    function adaptComponentStyles(fabBtn, chatPanel, viewport) {
        
        // 基于视口宽度和高度计算合适的字体大小和间距 - 大幅增大基础尺寸
        // 考虑到移动端的高DPI，使用更大的基础字体
        var baseFontSize = Math.max(28, Math.min(50, viewportWidth / 12)); // 28-50px (大幅增大)
        
        // 如果高度异常大（可能是开发工具），进一步放大字体
        if (viewportHeight > 1500) {
          baseFontSize = Math.max(35, Math.min(60, viewportWidth / 10)); // 35-60px
        }
        
        var basePadding = Math.max(18, Math.min(30, viewportWidth / 15)); // 18-30px (增大)
        var baseMargin = Math.max(12, Math.min(24, viewportWidth / 25)); // 12-24px (增大)
        
        // 计算面板高度（占视口的70-80%）
        var panelHeight = Math.min(viewportHeight * 0.75, viewportHeight - 100);
        
        // 强制注入内联样式确保生效
        panel.style.cssText += `
          font-size: ${baseFontSize}px !important;
          right: ${baseMargin}px !important;
          bottom: ${baseMargin}px !important;
          left: ${baseMargin}px !important;
          width: auto !important;
          height: ${panelHeight}px !important;
          max-height: ${panelHeight}px !important;
          border-radius: ${Math.max(16, basePadding)}px !important;
        `;
        
        // 强制设置输入框样式
        var inputText = panel.querySelector('input[type="text"]');
        if (inputText) {
          inputText.style.cssText += `
            font-size: ${baseFontSize + 4}px !important;
            padding: ${basePadding + 4}px ${basePadding + 6}px !important;
            min-height: ${baseFontSize * 2.8}px !important;
            border-radius: ${basePadding + 2}px !important;
          `;
        }
        
        // 强制设置按钮样式
        var buttons = panel.querySelectorAll('button');
        buttons.forEach(function(button) {
          // 特别处理发送按钮
          if (button.textContent.includes('发送') || button.className.includes('send')) {
            button.style.cssText += `
              font-size: ${baseFontSize + 2}px !important;
              padding: ${basePadding + 6}px ${basePadding + 10}px !important;
              min-width: ${baseFontSize * 3.5}px !important;
              height: ${baseFontSize * 2.8}px !important;
              border-radius: ${basePadding + 2}px !important;
            `;
          } else {
            button.style.cssText += `
              font-size: ${baseFontSize + 1}px !important;
              padding: ${basePadding + 4}px ${basePadding + 6}px !important;
              min-width: ${baseFontSize * 2.8}px !important;
              height: ${baseFontSize * 2.8}px !important;
              border-radius: ${basePadding + 2}px !important;
            `;
          }
        });
        
        // 强制设置头部样式
        var header = panel.querySelector('.qt-header');
        if (header) {
          header.style.cssText += `
            font-size: ${baseFontSize + 3}px !important;
            padding: ${basePadding + 8}px ${basePadding + 10}px !important;
            background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
            color: #fff !important;
          `;
        }
        
        // 强制设置头部样式
        var header = panel.querySelector('.qt-header');
        if (header) {
          header.style.cssText += `
            font-size: ${baseFontSize + 2}px !important;
            padding: ${basePadding + 6}px ${basePadding + 8}px !important;
            background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
            color: #fff !important;
          `;
        }
        
        // 设置消息区域样式
        var messagesArea = panel.querySelector('.qt-messages');
        if (messagesArea) {
          messagesArea.style.cssText += `
            font-size: ${baseFontSize + 2}px !important;
            padding: ${basePadding + 2}px !important;
            max-height: ${panelHeight - 200}px !important;
            line-height: 1.6 !important;
          `;
          
          // 设置消息项的字体大小
          var messageItems = messagesArea.querySelectorAll('.qt-message, .message');
          messageItems.forEach(function(item) {
            item.style.cssText += `
              font-size: ${baseFontSize + 2}px !important;
              line-height: 1.6 !important;
              margin-bottom: ${Math.max(12, basePadding)}px !important;
              padding: ${basePadding}px ${basePadding + 2}px !important;
            `;
          });
        }
        
        // 动态设置FAB按钮样式 - 大幅增大尺寸
        var fabSize = Math.max(80, Math.min(120, viewportWidth / 4.5)); // 80-120px (大幅增大)
        btn.style.cssText += `
          width: ${fabSize}px !important;
          height: ${fabSize}px !important;
          font-size: ${Math.max(24, fabSize / 2.5)}px !important;
          right: ${baseMargin}px !important;
          bottom: ${baseMargin + panelHeight + 30}px !important;
          border-radius: ${fabSize / 2}px !important;
          padding: 0 !important;
        `;
        
        console.log('✅ 已应用移动端样式 + 动态尺寸适配');
        console.log('📏 尺寸详情:', {
          基础字体: baseFontSize + 'px',
          输入框字体: (baseFontSize + 4) + 'px', 
          按钮字体: (baseFontSize + 1) + 'px',
          发送按钮字体: (baseFontSize + 2) + 'px',
          标题字体: (baseFontSize + 3) + 'px',
          消息字体: (baseFontSize + 2) + 'px',
          面板高度: panelHeight + 'px',
          FAB尺寸: fabSize + 'px',
          FAB字体: Math.max(24, fabSize / 2.5) + 'px',
          间距: basePadding + 'px',
          边距: baseMargin + 'px'
        });
      } else {
        body.classList.remove('qt-mobile', 'qt-force-mobile');
        panel.classList.remove('qt-mobile-panel');
        btn.classList.remove('qt-mobile-fab');
        
        // 清除移动端强制样式
        var elementsToClean = [panel].concat(
          Array.from(panel.querySelectorAll('input, button, .qt-header, .qt-messages, .qt-message, .message'))
        );
        
        elementsToClean.forEach(function(element) {
          if (element && element.style) {
            element.style.cssText = element.style.cssText.replace(/font-size:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/padding:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/min-height:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/min-width:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/height:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/max-height:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/line-height:[^;]*!important;?/g, '');
            element.style.cssText = element.style.cssText.replace(/margin-bottom:[^;]*!important;?/g, '');
          }
        });
        
        // 清除面板位置样式
        panel.style.cssText = panel.style.cssText.replace(/right:[^;]*!important;?/g, '');
        panel.style.cssText = panel.style.cssText.replace(/bottom:[^;]*!important;?/g, '');
        panel.style.cssText = panel.style.cssText.replace(/left:[^;]*!important;?/g, '');
    // 监听视口变化
    viewportManager.onChange(adaptToViewport);
    
    // 立即应用当前视口样式
    var currentViewport = viewportManager.getCurrentViewport();
    if (currentViewport) {
      adaptToViewport(currentViewport);
    }
            transform: none !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          }
          .qt-mobile .qt-messages {
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .qt-mobile .qt-input {
            flex-shrink: 0 !important;
          }
        `;
        
        // 横屏模式特殊处理
        if (viewport.isLandscape) {
          css += `
            .qt-mobile-landscape .qt-panel { 
              max-height: min(85vh, 400px) !important; 
            }
          `;
        }
        
        // 超小屏幕特殊优化
        if (viewport.breakpoint === 'ultra-small') {
          css += `
            .qt-viewport-ultra-small .qt-panel {
              border-radius: min(20px, 5vw) !important;
            }
            .qt-viewport-ultra-small .qt-fab {
              border-radius: 50% !important;
            }
          `;
        }
      }
      
      // 性能优化：只在CSS内容改变时才更新
      if (css !== lastCss) {
        style.textContent = css;
        style.setAttribute('data-last-css', css);
        console.log('🎨 动态补充样式已更新:', viewport.breakpoint, viewport.isRealMobile ? '[真实移动设备]' : '');
      }
    }
    
    // 监听视口变化
    viewportManager.onViewportChange(adaptToViewport);
    
    // 初始适配
    adaptToViewport(viewportManager.getCurrentViewport());
    
    return { 
      btn: btn, 
      panel: panel, 
      closeBtn: closeBtn,
      viewportManager: viewportManager
    };
  }

  function wireUI(client, ui) {
    var open = false;
    var input = ui.panel.querySelector('input[type="text"]');
    var send = ui.panel.querySelector('.qt-send-btn');
    var imageBtn = ui.panel.querySelector('.qt-image-btn');
    var fileBtn = ui.panel.querySelector('.qt-file-btn');
    var voiceBtn = ui.panel.querySelector('.qt-voice-btn');
    var imageInput = ui.panel.querySelector('.qt-image-input');
    var fileInput = ui.panel.querySelector('.qt-file-input');
    var body = ui.panel.querySelector('.qt-body');
    var closeBtn = ui.closeBtn;
    var uploading = false;
    var viewportManager = ui.viewportManager;
    
    // 语音录制相关变量
    var recording = false;
    var mediaRecorder = null;
    var audioChunks = [];
    var stream = null;

    // 发送消息函数
    function sendMessage() {
      var txt = input.value.trim();
      if (!txt || uploading) return;
      
      // 移动端：发送后立即失焦避免键盘遮挡
      var viewport = viewportManager.getCurrentViewport();
      if (viewport.isMobile) {
        input.blur();
      }
      
      client.sendMessage(txt, 'text');
      addMsg(txt, true);
      input.value = '';
    }

    function toggle() {
      open = !open;
      ui.panel.style.display = open ? 'flex' : 'none';
      if (open) {
        // 获取当前视口信息进行优化
        var viewport = viewportManager.getCurrentViewport();
        
        setTimeout(function() {
          if (viewport.isMobile) {
            // 移动端：滚动到输入框位置并智能聚焦
            input.scrollIntoView({ behavior: 'smooth', block: 'end' });
            setTimeout(function() {
              input.focus();
            }, 100);
          } else {
            input.focus();
          }
        }, 300);
      }
    }
    
    function close() {
      open = false;
      ui.panel.style.display = 'none';
    }

    function setUploading(state) {
      uploading = state;
      imageBtn.disabled = state;
      fileBtn.disabled = state;
      voiceBtn.disabled = state;
      send.disabled = state && !input.value.trim();
      imageBtn.style.opacity = state ? '0.5' : '1';
      fileBtn.style.opacity = state ? '0.5' : '1';
      voiceBtn.style.opacity = state ? '0.5' : '1';
    }
    
    // 语音录制功能
    function startRecording() {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(mediaStream) {
          stream = mediaStream;
          mediaRecorder = new MediaRecorder(mediaStream);
          audioChunks = [];
          
          mediaRecorder.ondataavailable = function(event) {
            audioChunks.push(event.data);
          };
          
          mediaRecorder.onstop = function() {
            var audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            uploadVoice(audioBlob);
            stopStream();
          };
          
          mediaRecorder.start();
          recording = true;
          voiceBtn.textContent = '⏹️';
          voiceBtn.title = '停止录音';
          voiceBtn.style.background = '#ef4444';
          voiceBtn.style.color = '#fff';
        })
        .catch(function(error) {
          console.error('无法访问麦克风:', error);
          addMsg('无法访问麦克风，请检查权限设置', true);
        });
    }
    
    function stopRecording() {
      if (mediaRecorder && recording) {
        mediaRecorder.stop();
        recording = false;
        voiceBtn.textContent = '🎤';
        voiceBtn.title = '发送语音';
        voiceBtn.style.background = '#fff';
        voiceBtn.style.color = '#333';
      }
    }
    
    function stopStream() {
      if (stream) {
        stream.getTracks().forEach(function(track) {
          track.stop();
        });
        stream = null;
      }
    }
    
    function uploadVoice(audioBlob) {
      setUploading(true);
      addMsg('正在发送语音...', true);
      
      var formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      formData.append('shopId', client.shopId);
      formData.append('messageType', 'voice');
      formData.append('customerCode', client.sessionId);
      
      // 构建上传URL
      var uploadUrl;
      if (client.serverConfig && client.serverConfig.endpoints && client.serverConfig.endpoints.upload) {
        uploadUrl = client.serverConfig.endpoints.upload;
      } else if (client.serverConfig && client.serverConfig.serverUrl) {
        uploadUrl = client.serverConfig.serverUrl + '/api/customer/upload';
      } else {
        console.error('❌ 无法获取服务器配置');
        addMsg('语音发送失败：服务器配置错误', true);
        setUploading(false);
        return;
      }
      
      fetch(uploadUrl, {
        method: 'POST',
        body: formData
      })
        .then(function(response) { 
          if (!response.ok) throw new Error('Upload failed');
          return response.json(); 
        })
        .then(function(data) {
          if (data.url) {
            client.sendMessage(data.url, 'voice', data.url);
          } else {
            addMsg('语音发送失败', true);
          }
        })
        .catch(function(error) {
          console.error('语音上传失败:', error);
          addMsg('语音发送失败', true);
        })
        .finally(function() {
          setUploading(false);
        });
    }

    function addMsg(text, own, type) {
      var item = document.createElement('div');
      item.className = 'qt-msg' + (own ? ' own' : '');
      
      if (type === 'image') {
        var img = document.createElement('img');
        img.src = text;
        img.onclick = function() { window.open(text, '_blank'); };
        item.appendChild(img);
      } else if (type === 'file') {
        var link = document.createElement('a');
        link.href = text;
        link.target = '_blank';
        link.textContent = '📎 ' + (text.split('/').pop() || '下载文件');
        item.appendChild(link);
      } else if (type === 'voice') {
        var audioContainer = document.createElement('div');
        audioContainer.style.cssText = 'display:flex;align-items:center;gap:8px;';
        
        var playButton = document.createElement('button');
        playButton.textContent = '▶️';
        playButton.style.cssText = 'background:none;border:none;cursor:pointer;font-size:18px;padding:4px;border-radius:50%;transition:background 0.2s ease;';
        playButton.onmouseover = function() { this.style.background = 'rgba(0,0,0,0.1)'; };
        playButton.onmouseout = function() { this.style.background = 'none'; };
        
        var duration = document.createElement('span');
        duration.textContent = '00:00';
        duration.style.cssText = 'font-size:12px;color:inherit;opacity:0.8;';
        
        var audio = document.createElement('audio');
        audio.src = text;
        audio.style.display = 'none';
        
        var isPlaying = false;
        
        playButton.onclick = function() {
          if (isPlaying) {
            audio.pause();
            playButton.textContent = '▶️';
            isPlaying = false;
          } else {
            audio.play();
            playButton.textContent = '⏸️';
            isPlaying = true;
          }
        };
        
        audio.onended = function() {
          playButton.textContent = '▶️';
          isPlaying = false;
        };
        
        audio.onloadedmetadata = function() {
          var minutes = Math.floor(audio.duration / 60);
          var seconds = Math.floor(audio.duration % 60);
          duration.textContent = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
        };
        
        audioContainer.appendChild(playButton);
        audioContainer.appendChild(duration);
        item.appendChild(audioContainer);
        item.appendChild(audio);
      } else {
        item.textContent = text;
      }
      
      body.appendChild(item);
      body.scrollTop = body.scrollHeight;
      
      // 添加进入动画
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';
      setTimeout(function() {
        item.style.transition = 'all 0.3s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, 10);
    }

    // 动态触摸反馈函数 - 根据当前视口状态调整
    function addTouchFeedback(element) {
      function updateTouchBehavior() {
        var viewport = viewportManager.getCurrentViewport();
        
        // 移除旧的事件监听器（避免重复绑定）
        element.removeEventListener('touchstart', element._touchStartHandler);
        element.removeEventListener('touchend', element._touchEndHandler);
        element.removeEventListener('touchcancel', element._touchCancelHandler);
        
        if (viewport.isTouch) {
          // 根据屏幕大小调整触摸反馈强度
          var scaleIntensity = viewport.breakpoint === 'ultra-small' ? 0.92 : 
                              viewport.breakpoint === 'small' ? 0.94 : 0.95;
          
          element._touchStartHandler = function() {
            this.style.transform = 'scale(' + scaleIntensity + ')';
            this.style.transition = 'transform 0.1s ease';
          };
          
          element._touchEndHandler = function() {
            var self = this;
            setTimeout(function() {
              self.style.transform = 'scale(1)';
            }, 100);
          };
          
          element._touchCancelHandler = function() {
            this.style.transform = 'scale(1)';
          };
          
          element.addEventListener('touchstart', element._touchStartHandler);
          element.addEventListener('touchend', element._touchEndHandler);
          element.addEventListener('touchcancel', element._touchCancelHandler);
        }
      }
      
      // 初始设置
      updateTouchBehavior();
      
      // 监听视口变化以更新触摸行为
      viewportManager.onViewportChange(updateTouchBehavior);
    }
    
    // 动态调整发送行为
    function sendMessage() {
      var txt = input.value.trim();
      if (!txt || uploading) return;
      
      var viewport = viewportManager.getCurrentViewport();
      
      // 移动端：发送后立即失焦避免键盘遮挡
      if (viewport.isMobile) {
        input.blur();
      }
      
      client.sendMessage(txt, 'text');
      addMsg(txt, true);
      input.value = '';
    }

    ui.btn.addEventListener('click', toggle);
    
    // 添加客服按钮触摸反馈
    addTouchFeedback(ui.btn);
    
    // 添加关闭按钮事件
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
      addTouchFeedback(closeBtn);
    }
    
    send.addEventListener('click', sendMessage);

    // 添加发送按钮触摸反馈
    addTouchFeedback(send);

    // 添加回车键发送消息功能
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        sendMessage();
      }
    });

    imageBtn.addEventListener('click', function() {
      if (uploading) return;
      imageInput.click();
    });
    addTouchFeedback(imageBtn);

    fileBtn.addEventListener('click', function() {
      if (uploading) return;
      fileInput.click();
    });
    addTouchFeedback(fileBtn);
    
    voiceBtn.addEventListener('click', function() {
      if (uploading) return;
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
    addTouchFeedback(voiceBtn);

    imageInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      
      setUploading(true);
      addMsg('正在上传图片...', true);
      
      client.uploadFile(file, 'image')
        .then(function() {
          // 成功消息会通过WebSocket接收
        })
        .catch(function(error) {
          addMsg('图片上传失败', true);
        })
        .finally(function() {
          setUploading(false);
          e.target.value = '';
        });
    });

    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      
      setUploading(true);
      addMsg('正在上传文件...', true);
      
      client.uploadFile(file, 'file')
        .then(function() {
          // 成功消息会通过WebSocket接收
        })
        .catch(function(error) {
          addMsg('文件上传失败', true);
        })
        .finally(function() {
          setUploading(false);
          e.target.value = '';
        });
    });

    client.on('message', function(m) {
      console.log('🔍 收到WebSocket消息:', JSON.stringify(m, null, 2));
      if (m && m.content) {
        if (m.metadata && m.metadata.messageType === 'image') {
          console.log('📷 图片消息 - file_url:', m.file_url, 'content:', m.content);
          addMsg(m.file_url || m.content, m.senderType === 'customer', 'image');
        } else if (m.metadata && m.metadata.messageType === 'file') {
          console.log('📁 文件消息 - file_url:', m.file_url, 'content:', m.content);
          addMsg(m.file_url || m.content, m.senderType === 'customer', 'file');
        } else if (m.metadata && m.metadata.messageType === 'voice') {
          console.log('🎤 语音消息 - file_url:', m.file_url, 'content:', m.content);
          addMsg(m.file_url || m.content, m.senderType === 'customer', 'voice');
        } else {
          addMsg(m.content, m.senderType === 'customer');
        }
      }
    });
  }

  // 全局接口
  window.QuickTalkCustomerService = {
    init: function(opts) {
      var serverUrl = (opts && opts.serverUrl) || (location.protocol + '//' + location.host);
      var shopId = opts && opts.shopId;
      if (!shopId) { 
        console.error('QuickTalk init: shopId 必填'); 
        return; 
      }

      onReady(function() {
        var client = createChatClient({ serverUrl: serverUrl, shopId: shopId });
        var ui = createUI();
        wireUI(client, ui);
        client.connect();
        
        // 移动端优化提示
        var isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          console.log('📱 移动端客服已优化: 动态视口适配、触摸反馈、全屏对话');
        } else {
          console.log('🖥️ 桌面端客服已优化: 响应式设计、智能适配');
        }
        
        // 启动版本检查
        checkForUpdates(serverUrl);
        setInterval(function() { checkForUpdates(serverUrl); }, UPDATE_CHECK_INTERVAL);
        
        console.log('✅ QuickTalk 客服系统已初始化 v' + CLIENT_VERSION + ' (动态视口适配版)');
        console.log('🔧 功能特性: 智能断点检测、实时适配、触摸优化、性能优化');
      });
    }
  };
})();