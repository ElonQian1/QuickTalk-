/* 简化版嵌入式客服 - 智能自适应地址检测 v1.3.0 */
(function(){
  // 版本信息
  var CLIENT_VERSION = '1.3.0';
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
          var wsUrl = config.wsUrl + '/customer/' + shopId + '/' + customerId;
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
          if (!self.serverConfig || !self.serverConfig.endpoints) {
            reject(new Error('服务器配置未加载'));
            return;
          }
          
          var formData = new FormData();
          formData.append('file', file);
          formData.append('shopId', shopId);
          formData.append('messageType', messageType || 'file');
          formData.append('customerCode', customerId);

          fetch(self.serverConfig.endpoints.upload, {
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

  function createUI() {
    if (document.getElementById('qt-fab')) {
      return {
        btn: document.getElementById('qt-fab'),
        panel: document.getElementById('qt-panel')
      };
    }

    var btn = document.createElement('div');
    btn.id = 'qt-fab';
    btn.className = 'qt-fab';
    btn.textContent = '客服';
    btn.style.cssText = 'position:fixed;right:18px;bottom:18px;background:#07C160;color:#fff;border-radius:999px;padding:12px 16px;box-shadow:0 10px 25px -12px rgba(7,193,96,.6);cursor:pointer;user-select:none;font:600 14px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;z-index:2147483647';

    var panel = document.createElement('div');
    panel.id = 'qt-panel';
    panel.className = 'qt-panel';
    panel.style.cssText = 'position:fixed;right:18px;bottom:68px;width:320px;height:440px;background:#fff;border-radius:12px;box-shadow:0 16px 48px -12px rgba(15,23,42,.35);display:none;flex-direction:column;overflow:hidden;z-index:2147483647';
    panel.innerHTML = '<div class="qt-header" style="padding:12px 14px;border-bottom:1px solid #eee;font-weight:700;background:#f9fafb">在线客服</div><div class="qt-body" style="flex:1;padding:10px 12px;overflow:auto;background:#fafafa"></div><div class="qt-input" style="display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff"><button class="qt-image-btn" title="发送图片" style="padding:8px;border-radius:8px;background:#fff;border:1px solid #ddd;cursor:pointer;font-size:16px">📷</button><button class="qt-file-btn" title="发送文件" style="padding:8px;border-radius:8px;background:#fff;border:1px solid #ddd;cursor:pointer;font-size:16px">📎</button><button class="qt-voice-btn" title="发送语音" style="padding:8px;border-radius:8px;background:#fff;border:1px solid #ddd;cursor:pointer;font-size:16px">🎤</button><input type="text" placeholder="输入消息..." style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px"/><button class="qt-send-btn" style="padding:8px 12px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer">发送</button><input type="file" class="qt-image-input" accept="image/*" style="display:none"/><input type="file" class="qt-file-input" style="display:none"/></div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    return { btn: btn, panel: panel };
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
    var uploading = false;
    
    // 语音录制相关变量
    var recording = false;
    var mediaRecorder = null;
    var audioChunks = [];
    var stream = null;

    function toggle() {
      open = !open;
      ui.panel.style.display = open ? 'flex' : 'none';
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
      
      fetch(client.serverUrl + '/api/customer/upload', {
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
      item.style.cssText = 'background:' + (own ? '#2563eb' : '#fff') + ';color:' + (own ? '#fff' : '#333') + ';margin:6px 0;padding:8px 10px;border-radius:10px;max-width:78%;' + (own ? 'margin-left:auto;' : '');
      
      if (type === 'image') {
        var img = document.createElement('img');
        img.src = text;
        img.style.cssText = 'max-width:200px;max-height:200px;border-radius:8px;cursor:pointer';
        img.onclick = function() { window.open(text, '_blank'); };
        item.appendChild(img);
      } else if (type === 'file') {
        var link = document.createElement('a');
        link.href = text;
        link.target = '_blank';
        link.textContent = '📎 ' + (text.split('/').pop() || '下载文件');
        link.style.cssText = 'color:inherit;text-decoration:underline';
        item.appendChild(link);
      } else if (type === 'voice') {
        var audioContainer = document.createElement('div');
        audioContainer.style.cssText = 'display:flex;align-items:center;gap:8px;';
        
        var playButton = document.createElement('button');
        playButton.textContent = '▶️';
        playButton.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;';
        
        var duration = document.createElement('span');
        duration.textContent = '00:00';
        duration.style.cssText = 'font-size:12px;';
        
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
    }

    ui.btn.addEventListener('click', toggle);
    
    send.addEventListener('click', function() {
      var txt = input.value.trim();
      if (!txt || uploading) return;
      client.sendMessage(txt, 'text');
      addMsg(txt, true);
      input.value = '';
    });

    imageBtn.addEventListener('click', function() {
      if (uploading) return;
      imageInput.click();
    });

    fileBtn.addEventListener('click', function() {
      if (uploading) return;
      fileInput.click();
    });
    
    voiceBtn.addEventListener('click', function() {
      if (uploading) return;
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

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
        
        // 启动版本检查
        checkForUpdates(serverUrl);
        setInterval(function() { checkForUpdates(serverUrl); }, UPDATE_CHECK_INTERVAL);
        
        console.log('QuickTalk 客服系统已初始化 v' + CLIENT_VERSION + ' (自动更新架构)');
      });
    }
  };
})();