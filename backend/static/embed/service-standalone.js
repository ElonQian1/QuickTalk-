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
      var isLandscape = width > height;
      
      var breakpoint = 'extra-large';
      if (width <= breakpoints['ultra-small']) {
        breakpoint = 'ultra-small';
      } else if (width <= breakpoints['small']) {
        breakpoint = 'small';
      } else if (width <= breakpoints['medium']) {
        breakpoint = 'medium';
      } else if (width <= breakpoints['large']) {
        breakpoint = 'large';
      }
      
      return {
        breakpoint: breakpoint,
        width: width,
        height: height,
        isLandscape: isLandscape,
        isMobile: width <= breakpoints['medium'],
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0
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
    
    function updateViewport() {
      var viewport = detectBreakpoint();
      var breakpointChanged = viewport.breakpoint !== currentBreakpoint;
      
      if (breakpointChanged) {
        currentBreakpoint = viewport.breakpoint;
        console.log('📱 动态视口适配:', viewport.breakpoint, viewport.width + 'x' + viewport.height, 
          viewport.isMobile ? '(移动端)' : '(桌面端)', 
          viewport.isTouch ? '(触摸)' : '(鼠标)',
          viewport.isLandscape ? '(横屏)' : '(竖屏)');
        notifyChange(viewport);
      }
      
      return viewport;
    }
    
    // 初始检测
    updateViewport();
    
    // 监听窗口大小变化
    var resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateViewport, 150);
    });
    
    // 监听方向变化
    window.addEventListener('orientationchange', function() {
      setTimeout(updateViewport, 500);
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
    
    // 动态适配函数
    function adaptToViewport(viewport) {
      // 动态添加视口类名
      var body = document.body;
      body.className = body.className.replace(/qt-viewport-\w+/g, '');
      body.classList.add('qt-viewport-' + viewport.breakpoint);
      
      if (viewport.isMobile) {
        body.classList.add('qt-mobile');
      } else {
        body.classList.remove('qt-mobile');
      }
      
      if (viewport.isTouch) {
        body.classList.add('qt-touch');
      } else {
        body.classList.remove('qt-touch');
      }
      
      if (viewport.isLandscape && viewport.isMobile) {
        body.classList.add('qt-mobile-landscape');
      } else {
        body.classList.remove('qt-mobile-landscape');
      }
      
      // 动态调整组件样式
      adaptComponentStyles(btn, panel, viewport);
    }
    
    function adaptComponentStyles(fabBtn, chatPanel, viewport) {
      var style = document.getElementById('qt-dynamic-styles');
      if (!style) {
        style = document.createElement('style');
        style.id = 'qt-dynamic-styles';
        document.head.appendChild(style);
      }
      
      var css = '';
      var lastCss = style.getAttribute('data-last-css') || '';
      
      if (viewport.breakpoint === 'ultra-small') {
        css = `
          .qt-fab { 
            padding: 26px 30px !important; 
            font-size: 22px !important; 
            min-width: 85px !important; 
            min-height: 85px !important; 
          }
          .qt-panel { 
            height: 85vh !important; 
            border-radius: 28px !important; 
            right: 4px !important; 
            left: 4px !important; 
            bottom: 4px !important; 
          }
          .qt-input input[type="text"] { 
            font-size: 20px !important; 
            min-height: 60px !important; 
          }
          .qt-input button { 
            min-width: 60px !important; 
            height: 60px !important; 
          }
        `;
      } else if (viewport.breakpoint === 'small') {
        css = `
          .qt-fab { 
            padding: 24px 28px !important; 
            font-size: 20px !important; 
            min-width: 80px !important; 
            min-height: 80px !important; 
          }
          .qt-panel { 
            height: 80vh !important; 
            border-radius: 24px !important; 
            right: 6px !important; 
            left: 6px !important; 
            bottom: 6px !important; 
          }
          .qt-input input[type="text"] { 
            font-size: 19px !important; 
            min-height: 56px !important; 
          }
        `;
      } else if (viewport.breakpoint === 'medium' && viewport.isMobile) {
        css = `
          .qt-fab { 
            padding: 20px 24px !important; 
            font-size: 18px !important; 
            min-width: 72px !important; 
            min-height: 72px !important; 
          }
          .qt-panel { 
            height: 75vh !important; 
            border-radius: 20px !important; 
            right: 8px !important; 
            left: 8px !important; 
            bottom: 8px !important; 
          }
          .qt-input input[type="text"] { 
            font-size: 18px !important; 
            min-height: 52px !important; 
          }
        `;
      }
      
      // 横屏模式特殊处理
      if (viewport.isLandscape && viewport.isMobile) {
        css += `
          .qt-panel { 
            height: 85vh !important; 
            max-height: 450px !important; 
          }
        `;
      }
      
      // 性能优化：只在CSS内容改变时才更新
      if (css !== lastCss) {
        style.textContent = css;
        style.setAttribute('data-last-css', css);
        console.log('🎨 动态样式已更新:', viewport.breakpoint);
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