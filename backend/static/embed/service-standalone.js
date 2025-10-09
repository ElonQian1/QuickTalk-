/* 简化版嵌入式客服 - 自动更新架构 v1.2.0 */
(function(){
  // 版本信息
  var CLIENT_VERSION = '1.2.0';
  var UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟检查一次
  
  // 版本检测和自动更新
  function checkForUpdates(serverUrl) {
    if (!serverUrl) return;
    
    fetch(serverUrl + '/api/sdk/version')
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.version && data.version !== CLIENT_VERSION) {
          console.log('🔄 检测到新版本:', data.version, '当前版本:', CLIENT_VERSION);
          // 可以在这里添加通知用户更新的逻辑
          // 或者自动重新加载（谨慎使用）
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

  // 直接通过fetch API与后端通信，不依赖SDK
  function createChatClient(config) {
    var serverUrl = config.serverUrl || (location.protocol + '//' + location.host);
    var shopId = config.shopId;
    var customerId = 'guest-' + Math.random().toString(36).slice(2);
    var ws = null;
    var eventHandlers = {};

    return {
      serverUrl: serverUrl,
      shopId: shopId,
      sessionId: customerId,
      connect: function() {
        var wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws/customer/' + shopId + '/' + customerId;
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
          ws.send(JSON.stringify({
            messageType: 'auth',
            metadata: { apiKey: shopId, customerId: customerId }
          }));
          emit('connected');
        };
        
        ws.onmessage = function(event) {
          var message = JSON.parse(event.data);
          if (message.messageType === 'new_message') {
            emit('message', message);
          }
        };
        
        ws.onclose = function() { emit('disconnected'); };
        ws.onerror = function(error) { emit('error', error); };
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
        }
      },

      uploadFile: function(file, messageType) {
        return new Promise(function(resolve, reject) {
          var formData = new FormData();
          formData.append('file', file);
          formData.append('shopId', shopId);
          formData.append('messageType', messageType || 'file');
          formData.append('customerCode', customerId);

          fetch(serverUrl + '/api/customer/upload', {
            method: 'POST',
            body: formData
          })
          .then(function(response) {
            if (!response.ok) throw new Error('Upload failed');
            return response.json();
          })
          .then(function(data) {
            // 自动发送消息 - 对于图片，content应该是URL而不是文件名
            this.sendMessage(data.url, messageType, data.url);
            resolve(data);
          }.bind(this))
          .catch(reject);
        }.bind(this));
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