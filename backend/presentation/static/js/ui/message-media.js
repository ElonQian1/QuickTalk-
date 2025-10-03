/*
 * UI: 消息媒体渲染 (message-media.js)
 * - 负责根据文件类型渲染图片/音频/视频/通用文件卡片
 * - 提供图片预览模态
 * - 与 MessageModule 解耦，作为独立 UI 组件暴露到 window 下
 */
(function(){
  'use strict';

  function getFileIcon(mimeType){
    if (!mimeType) return '📁';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('text')) return '📃';
    return '📁';
  }

  function formatFileSize(bytes){
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function openImageModal(imageSrc){
    var modal = document.createElement('div');
    modal.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.9)', 'display:flex', 'align-items:center',
      'justify-content:center', 'z-index:1000'
    ].join(';');

    var img = document.createElement('img');
    img.src = imageSrc;
    img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = [
      'position:absolute', 'top:20px', 'right:20px', 'background:rgba(255,255,255,0.8)',
      'border:none', 'border-radius:50%', 'width:40px', 'height:40px',
      'font-size:24px', 'cursor:pointer'
    ].join(';');

    closeBtn.onclick = function(){ if (modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.onclick = function(e){ if (e.target === modal && modal.parentNode) modal.parentNode.removeChild(modal); };

    modal.appendChild(img);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
  }

  function createMediaElement(file){
    var mediaDiv = document.createElement('div');

    if (!file || !file.url || file.url === 'undefined') {
      console.error('文件URL无效:', file);
      mediaDiv.innerHTML = '<p>文件URL无效</p>';
      return mediaDiv;
    }

    if (file.type && file.type.startsWith && file.type.startsWith('image/')) {
      mediaDiv.className = 'message-media';
      var img = document.createElement('img');
      img.src = file.url;
      img.alt = file.name || '图片';
      img.onclick = function(){ openImageModal(file.url); };
      img.onerror = function(){ console.error('图片加载失败:', file.url); img.alt = '图片加载失败'; };
      mediaDiv.appendChild(img);
      return mediaDiv;
    }

    if (file.type && file.type.startsWith && file.type.startsWith('audio/')) {
      mediaDiv.className = 'message-audio';
      var audio = document.createElement('audio');
      audio.controls = true;
      audio.src = file.url;
      audio.preload = 'metadata';
      mediaDiv.appendChild(audio);
      return mediaDiv;
    }

    if (file.type && file.type.startsWith && file.type.startsWith('video/')) {
      mediaDiv.className = 'message-media';
      var video = document.createElement('video');
      video.controls = true;
      video.src = file.url;
      video.style.maxWidth = '100%';
      video.style.borderRadius = '8px';
      mediaDiv.appendChild(video);
      return mediaDiv;
    }

    // 其他类型：文件卡片
    mediaDiv.className = 'message-file';
    mediaDiv.innerHTML = [
      '<div class="file-icon">', getFileIcon(file.type), '</div>',
      '<div class="file-details">',
        '<div class="file-name">', (file.name || '文件'), '</div>',
        '<div class="file-size">', formatFileSize(file.size), '</div>',
      '</div>'
    ].join('');
    mediaDiv.onclick = function(){ window.open(file.url, '_blank'); };
    return mediaDiv;
  }

  window.MessageMediaUI = {
    createMediaElement: createMediaElement,
    openImageModal: openImageModal,
    getFileIcon: getFileIcon,
    formatFileSize: formatFileSize
  };

  console.log('✅ UI 组件已加载 (message-media.js)');
})();
