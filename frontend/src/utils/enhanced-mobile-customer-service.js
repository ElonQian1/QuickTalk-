/**
 * 增强移动端客服系统 - 包含拍照、语音、位置等移动端特有功能
 * 
 * @author QuickTalk Team
 * @version 3.0.0
 * @date 2025-09-13
 */

class EnhancedMobileCustomerService {
    constructor() {
        this.currentUser = null;
        this.shops = [];
        this.conversations = {};
        this.currentShop = null;
        this.currentConversation = null;
        this.unreadCounts = {};
        this.websocket = null;
        this.pageStack = ['home'];
        this.isInitialized = false;
        
        // 移动端增强功能
        this.mediaRecorder = null;
        this.isRecording = false;
        this.audioChunks = [];
        this.cameraStream = null;
        this.geolocation = null;
        
        // 触摸手势
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.pullToRefreshThreshold = 80;
        this.isPulling = false;
        
        // 输入框增强
        this.isComposing = false;
        this.inputHistory = [];
        this.currentHistoryIndex = -1;
        
        console.log('📱 增强移动端客服系统初始化');
    }

    /**
     * 初始化增强客服系统
     */
    async init() {
        if (this.isInitialized) {
            console.log('⚠️ 客服系统已初始化，跳过重复初始化');
            return;
        }

        try {
            console.log('🚀 开始初始化增强移动端客服系统...');
            
            // 检测移动端设备能力
            await this.detectDeviceCapabilities();
            
            // 获取当前用户信息
            await this.getCurrentUser();
            
            // 加载店铺列表
            await this.loadShops();
            
            // 加载未读消息统计
            await this.loadUnreadCounts();
            
            // 初始化WebSocket连接
            this.initWebSocket();
            
            // 绑定增强事件监听器
            this.bindEnhancedEvents();
            
            // 初始化移动端特有功能
            this.initMobileFeatures();
            
            // 初始化PWA功能
            this.initPWAFeatures();
            
            this.isInitialized = true;
            console.log('✅ 增强移动端客服系统初始化完成');
            
        } catch (error) {
            console.error('❌ 客服系统初始化失败:', error);
            this.showError('系统初始化失败: ' + error.message);
        }
    }

    /**
     * 检测设备能力
     */
    async detectDeviceCapabilities() {
        const capabilities = {
            camera: false,
            microphone: false,
            geolocation: false,
            touchscreen: false,
            vibration: false,
            notification: false,
            orientation: false,
            battery: false
        };

        // 检测摄像头
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            capabilities.camera = true;
            stream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.log('📷 摄像头不可用:', e.message);
        }

        // 检测麦克风
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            capabilities.microphone = true;
            stream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.log('🎤 麦克风不可用:', e.message);
        }

        // 检测地理位置
        capabilities.geolocation = 'geolocation' in navigator;

        // 检测触摸屏
        capabilities.touchscreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // 检测震动
        capabilities.vibration = 'vibrate' in navigator;

        // 检测通知权限
        capabilities.notification = 'Notification' in window;

        // 检测屏幕旋转
        capabilities.orientation = 'orientation' in screen;

        // 检测电池状态
        capabilities.battery = 'getBattery' in navigator;

        this.deviceCapabilities = capabilities;
        console.log('📱 设备能力检测完成:', capabilities);
        
        // 更新UI显示可用功能
        this.updateUIBasedOnCapabilities();
    }

    /**
     * 根据设备能力更新UI
     */
    updateUIBasedOnCapabilities() {
        // 显示/隐藏功能按钮
        const cameraBtn = document.getElementById('cameraBtn');
        const voiceBtn = document.getElementById('voiceBtn');
        const locationBtn = document.getElementById('locationBtn');

        if (cameraBtn) {
            cameraBtn.style.display = this.deviceCapabilities.camera ? 'block' : 'none';
        }
        
        if (voiceBtn) {
            voiceBtn.style.display = this.deviceCapabilities.microphone ? 'block' : 'none';
        }
        
        if (locationBtn) {
            locationBtn.style.display = this.deviceCapabilities.geolocation ? 'block' : 'none';
        }
    }

    /**
     * 初始化移动端特有功能
     */
    initMobileFeatures() {
        // 初始化下拉刷新
        this.initPullToRefresh();
        
        // 初始化触摸手势
        this.initTouchGestures();
        
        // 初始化输入增强
        this.initInputEnhancements();
        
        // 初始化屏幕旋转处理
        this.initOrientationHandler();
        
        // 初始化网络状态监听
        this.initNetworkStatusListener();
        
        console.log('📱 移动端特有功能初始化完成');
    }

    /**
     * 初始化下拉刷新
     */
    initPullToRefresh() {
        const container = document.querySelector('.chat-container, .shop-list, .conversation-list');
        if (!container) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        container.addEventListener('touchstart', (e) => {
            if (container.scrollTop === 0) {
                startY = e.touches[0].clientY;
                isDragging = true;
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0 && container.scrollTop === 0) {
                e.preventDefault();
                const pullDistance = Math.min(deltaY, this.pullToRefreshThreshold * 1.5);
                
                // 显示下拉指示器
                this.showPullToRefreshIndicator(pullDistance);
                
                if (pullDistance >= this.pullToRefreshThreshold) {
                    this.isPulling = true;
                    this.vibrate(50); // 触觉反馈
                }
            }
        }, { passive: false });

        container.addEventListener('touchend', () => {
            if (isDragging && this.isPulling) {
                this.triggerRefresh();
            }
            
            isDragging = false;
            this.isPulling = false;
            this.hidePullToRefreshIndicator();
        }, { passive: true });
    }

    /**
     * 显示下拉刷新指示器
     */
    showPullToRefreshIndicator(distance) {
        let indicator = document.getElementById('pullToRefreshIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pullToRefreshIndicator';
            indicator.innerHTML = `
                <div class="pull-indicator">
                    <div class="pull-icon">⬇️</div>
                    <div class="pull-text">下拉刷新</div>
                </div>
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.style.display = 'block';
        indicator.style.transform = `translateY(${distance}px)`;
        
        if (distance >= this.pullToRefreshThreshold) {
            indicator.querySelector('.pull-text').textContent = '释放刷新';
            indicator.querySelector('.pull-icon').textContent = '🔄';
        } else {
            indicator.querySelector('.pull-text').textContent = '下拉刷新';
            indicator.querySelector('.pull-icon').textContent = '⬇️';
        }
    }

    /**
     * 隐藏下拉刷新指示器
     */
    hidePullToRefreshIndicator() {
        const indicator = document.getElementById('pullToRefreshIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * 触发刷新
     */
    async triggerRefresh() {
        const indicator = document.getElementById('pullToRefreshIndicator');
        if (indicator) {
            indicator.querySelector('.pull-text').textContent = '刷新中...';
            indicator.querySelector('.pull-icon').textContent = '🔄';
        }

        try {
            // 根据当前页面刷新对应数据
            const currentPage = this.getCurrentPage();
            switch (currentPage) {
                case 'home':
                    await this.loadShops();
                    await this.loadUnreadCounts();
                    break;
                case 'shop':
                    await this.loadConversations(this.currentShop.id);
                    break;
                case 'chat':
                    await this.loadMessages(this.currentConversation.id);
                    break;
            }
            
            this.showSuccess('刷新完成');
        } catch (error) {
            console.error('刷新失败:', error);
            this.showError('刷新失败');
        }
        
        setTimeout(() => {
            this.hidePullToRefreshIndicator();
        }, 1000);
    }

    /**
     * 拍照功能
     */
    async takePhoto() {
        if (!this.deviceCapabilities.camera) {
            this.showError('设备不支持拍照功能');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment', // 后置摄像头
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            this.showCameraModal(stream);
        } catch (error) {
            console.error('拍照失败:', error);
            this.showError('无法访问摄像头: ' + error.message);
        }
    }

    /**
     * 显示相机模态框
     */
    showCameraModal(stream) {
        const modal = document.createElement('div');
        modal.className = 'camera-modal';
        modal.innerHTML = `
            <div class="camera-container">
                <video id="cameraPreview" autoplay playsinline></video>
                <canvas id="photoCanvas" style="display: none;"></canvas>
                <div class="camera-controls">
                    <button class="camera-btn cancel-btn" onclick="this.closest('.camera-modal').remove()">取消</button>
                    <button class="camera-btn capture-btn" onclick="enhancedMobileService.capturePhoto()">拍照</button>
                    <button class="camera-btn switch-btn" onclick="enhancedMobileService.switchCamera()">翻转</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const video = document.getElementById('cameraPreview');
        video.srcObject = stream;
        this.cameraStream = stream;
        
        // 添加拍照手势
        video.addEventListener('click', () => {
            this.capturePhoto();
        });
    }

    /**
     * 拍照
     */
    capturePhoto() {
        const video = document.getElementById('cameraPreview');
        const canvas = document.getElementById('photoCanvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        // 转换为blob
        canvas.toBlob((blob) => {
            this.handlePhotoCapture(blob);
        }, 'image/jpeg', 0.8);
        
        // 拍照音效和震动反馈
        this.playShutterSound();
        this.vibrate(100);
    }

    /**
     * 处理拍照结果
     */
    async handlePhotoCapture(blob) {
        // 关闭相机
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        
        // 移除相机模态框
        const modal = document.querySelector('.camera-modal');
        if (modal) modal.remove();
        
        // 上传图片
        await this.uploadImage(blob);
    }

    /**
     * 语音录制功能
     */
    async startVoiceRecording() {
        if (!this.deviceCapabilities.microphone) {
            this.showError('设备不支持录音功能');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.isRecording = true;
            
            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                this.audioChunks.push(event.data);
            });
            
            this.mediaRecorder.addEventListener('stop', () => {
                this.handleVoiceRecordingStop();
            });
            
            this.mediaRecorder.start();
            this.showVoiceRecordingUI();
            
            // 震动反馈
            this.vibrate([50, 100, 50]);
            
        } catch (error) {
            console.error('录音失败:', error);
            this.showError('无法访问麦克风: ' + error.message);
        }
    }

    /**
     * 停止语音录制
     */
    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.hideVoiceRecordingUI();
        }
    }

    /**
     * 处理语音录制结束
     */
    async handleVoiceRecordingStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // 停止所有音轨
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        // 上传语音
        await this.uploadAudio(audioBlob);
    }

    /**
     * 显示语音录制UI
     */
    showVoiceRecordingUI() {
        const recordingUI = document.createElement('div');
        recordingUI.id = 'voiceRecordingUI';
        recordingUI.className = 'voice-recording-ui';
        recordingUI.innerHTML = `
            <div class="recording-indicator">
                <div class="recording-animation">🎤</div>
                <div class="recording-text">正在录音...</div>
                <div class="recording-timer">00:00</div>
            </div>
            <div class="recording-controls">
                <button class="recording-btn cancel-btn" onclick="enhancedMobileService.cancelVoiceRecording()">取消</button>
                <button class="recording-btn stop-btn" onclick="enhancedMobileService.stopVoiceRecording()">发送</button>
            </div>
        `;
        
        document.body.appendChild(recordingUI);
        
        // 开始计时
        this.startRecordingTimer();
    }

    /**
     * 隐藏语音录制UI
     */
    hideVoiceRecordingUI() {
        const recordingUI = document.getElementById('voiceRecordingUI');
        if (recordingUI) {
            recordingUI.remove();
        }
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
    }

    /**
     * 开始录制计时
     */
    startRecordingTimer() {
        let seconds = 0;
        this.recordingTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            const timeText = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            
            const timerElement = document.querySelector('.recording-timer');
            if (timerElement) {
                timerElement.textContent = timeText;
            }
            
            // 最长录音60秒
            if (seconds >= 60) {
                this.stopVoiceRecording();
            }
        }, 1000);
    }

    /**
     * 取消语音录制
     */
    cancelVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        
        // 停止所有音轨
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        this.hideVoiceRecordingUI();
    }

    /**
     * 获取地理位置
     */
    async shareLocation() {
        if (!this.deviceCapabilities.geolocation) {
            this.showError('设备不支持地理定位');
            return;
        }

        this.showLoading('正在获取位置...');
        
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                });
            });
            
            const { latitude, longitude } = position.coords;
            
            // 获取地址信息
            const address = await this.reverseGeocode(latitude, longitude);
            
            this.hideLoading();
            this.showLocationConfirmDialog(latitude, longitude, address);
            
        } catch (error) {
            this.hideLoading();
            console.error('获取位置失败:', error);
            this.showError('无法获取位置信息: ' + this.getLocationErrorMessage(error));
        }
    }

    /**
     * 反向地理编码
     */
    async reverseGeocode(latitude, longitude) {
        try {
            // 这里可以集成百度地图、高德地图等API
            // 为了简化，这里返回坐标信息
            return `纬度: ${latitude.toFixed(6)}, 经度: ${longitude.toFixed(6)}`;
        } catch (error) {
            console.error('地理编码失败:', error);
            return `纬度: ${latitude.toFixed(6)}, 经度: ${longitude.toFixed(6)}`;
        }
    }

    /**
     * 显示位置确认对话框
     */
    showLocationConfirmDialog(latitude, longitude, address) {
        const modal = document.createElement('div');
        modal.className = 'location-modal';
        modal.innerHTML = `
            <div class="location-container">
                <div class="location-header">
                    <h3>分享位置</h3>
                </div>
                <div class="location-content">
                    <div class="location-icon">📍</div>
                    <div class="location-info">
                        <div class="location-address">${address}</div>
                        <div class="location-coords">坐标: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}</div>
                    </div>
                </div>
                <div class="location-controls">
                    <button class="location-btn cancel-btn" onclick="this.closest('.location-modal').remove()">取消</button>
                    <button class="location-btn send-btn" onclick="enhancedMobileService.sendLocation(${latitude}, ${longitude}, '${address}')">发送位置</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * 发送位置信息
     */
    async sendLocation(latitude, longitude, address) {
        const locationData = {
            type: 'location',
            latitude: latitude,
            longitude: longitude,
            address: address,
            timestamp: Date.now()
        };
        
        await this.sendMessage(JSON.stringify(locationData), 'location');
        
        // 移除模态框
        const modal = document.querySelector('.location-modal');
        if (modal) modal.remove();
        
        this.showSuccess('位置已发送');
    }

    /**
     * 获取位置错误信息
     */
    getLocationErrorMessage(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return '用户拒绝了地理定位请求';
            case error.POSITION_UNAVAILABLE:
                return '位置信息不可用';
            case error.TIMEOUT:
                return '请求位置信息超时';
            default:
                return '获取位置时发生未知错误';
        }
    }

    /**
     * 震动反馈
     */
    vibrate(pattern) {
        if (this.deviceCapabilities.vibration) {
            navigator.vibrate(pattern);
        }
    }

    /**
     * 播放拍照音效
     */
    playShutterSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAdBjmR2+/PdCwELozG7NyOPgkSXrLqwKN3JAT8Ysa19jV4PAg9TqSj2t+dQw0UAAAAAAABAAIBAAABACQAAAAAAAAAAAAB');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // 忽略播放失败
            });
        } catch (error) {
            // 忽略音效播放错误
        }
    }

    /**
     * 上传图片
     */
    async uploadImage(blob) {
        const formData = new FormData();
        formData.append('image', blob, 'photo.jpg');
        formData.append('type', 'image');
        
        try {
            this.showLoading('正在上传图片...');
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'X-Session-Id': localStorage.getItem('sessionId')
                },
                body: formData
            });
            
            const result = await response.json();
            this.hideLoading();
            
            if (result.success) {
                await this.sendMessage(result.url, 'image');
                this.showSuccess('图片发送成功');
            } else {
                throw new Error(result.error || '上传失败');
            }
        } catch (error) {
            this.hideLoading();
            console.error('上传图片失败:', error);
            this.showError('图片上传失败: ' + error.message);
        }
    }

    /**
     * 上传音频
     */
    async uploadAudio(blob) {
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');
        formData.append('type', 'audio');
        
        try {
            this.showLoading('正在上传语音...');
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'X-Session-Id': localStorage.getItem('sessionId')
                },
                body: formData
            });
            
            const result = await response.json();
            this.hideLoading();
            
            if (result.success) {
                await this.sendMessage(result.url, 'audio');
                this.showSuccess('语音发送成功');
            } else {
                throw new Error(result.error || '上传失败');
            }
        } catch (error) {
            this.hideLoading();
            console.error('上传语音失败:', error);
            this.showError('语音上传失败: ' + error.message);
        }
    }

    /**
     * 初始化触摸手势
     */
    initTouchGestures() {
        // 双击返回
        let lastTapTime = 0;
        document.addEventListener('touchend', (e) => {
            const currentTime = Date.now();
            if (currentTime - lastTapTime < 300) {
                // 双击事件
                this.handleDoubleTap(e);
            }
            lastTapTime = currentTime;
        });
        
        // 长按事件
        let pressTimer;
        document.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                this.handleLongPress(e);
            }, 500);
        });
        
        document.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        document.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }

    /**
     * 处理双击事件
     */
    handleDoubleTap(e) {
        // 在聊天界面双击可以快速滚动到底部
        if (this.getCurrentPage() === 'chat') {
            this.scrollToBottom();
            this.vibrate(50);
        }
    }

    /**
     * 处理长按事件
     */
    handleLongPress(e) {
        const target = e.target;
        
        // 长按消息可以复制或转发
        if (target.closest('.message-item')) {
            this.showMessageContextMenu(target.closest('.message-item'), e);
            this.vibrate(100);
        }
    }

    /**
     * 初始化PWA功能
     */
    initPWAFeatures() {
        // 检查是否已安装PWA
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });
        
        // 检查是否在PWA模式下运行
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('PWA模式运行');
            this.isPWAMode = true;
        }
        
        // 注册Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW注册成功:', registration);
                })
                .catch(error => {
                    console.log('SW注册失败:', error);
                });
        }
    }

    /**
     * 初始化网络状态监听
     */
    initNetworkStatusListener() {
        window.addEventListener('online', () => {
            this.handleNetworkOnline();
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkOffline();
        });
        
        // 检查当前网络状态
        if (!navigator.onLine) {
            this.handleNetworkOffline();
        }
    }

    /**
     * 处理网络连接
     */
    handleNetworkOnline() {
        this.showSuccess('网络已连接');
        this.hideOfflineIndicator();
        
        // 重新连接WebSocket
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            this.initWebSocket();
        }
        
        // 同步离线消息
        this.syncOfflineMessages();
    }

    /**
     * 处理网络断开
     */
    handleNetworkOffline() {
        this.showError('网络连接已断开');
        this.showOfflineIndicator();
    }

    /**
     * 显示离线指示器
     */
    showOfflineIndicator() {
        let indicator = document.getElementById('offlineIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offlineIndicator';
            indicator.className = 'offline-indicator';
            indicator.textContent = '📶 网络已断开';
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
    }

    /**
     * 隐藏离线指示器
     */
    hideOfflineIndicator() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '加载中...') {
        let loader = document.getElementById('loadingIndicator');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loadingIndicator';
            loader.className = 'loading-indicator';
            loader.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            document.body.appendChild(loader);
        } else {
            loader.querySelector('.loading-text').textContent = message;
        }
        loader.style.display = 'flex';
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loader = document.getElementById('loadingIndicator');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * 显示Toast消息
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 触发动画
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 100);
        
        // 自动隐藏
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    /**
     * 获取当前页面
     */
    getCurrentPage() {
        return this.pageStack[this.pageStack.length - 1] || 'home';
    }

    /**
     * 绑定增强事件监听器
     */
    bindEnhancedEvents() {
        // 绑定基础事件
        this.bindEvents();
        
        // 添加移动端特有事件
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleAppBackground();
            } else {
                this.handleAppForeground();
            }
        });
        
        // 阻止默认的下拉刷新
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * 处理应用进入后台
     */
    handleAppBackground() {
        console.log('应用进入后台');
        // 可以在这里暂停某些功能以节省电量
    }

    /**
     * 处理应用进入前台
     */
    handleAppForeground() {
        console.log('应用进入前台');
        // 恢复功能，检查新消息等
        this.checkNewMessages();
    }

    // 继承原有的方法
    async getCurrentUser() {
        // 从原有的 MobileCustomerService 复制
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            throw new Error('未找到登录会话');
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                console.log('👤 当前用户:', this.currentUser.username);
            } else {
                throw new Error('获取用户信息失败');
            }
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error);
            throw error;
        }
    }

    async loadShops() {
        // 实现店铺加载逻辑
        console.log('加载店铺列表...');
    }

    async loadUnreadCounts() {
        // 实现未读消息统计加载
        console.log('加载未读消息统计...');
    }

    initWebSocket() {
        // 实现WebSocket连接
        console.log('初始化WebSocket连接...');
    }

    bindEvents() {
        // 实现基础事件绑定
        console.log('绑定基础事件...');
    }

    // 其他需要的方法...
    async sendMessage(content, type = 'text') {
        console.log('发送消息:', content, type);
    }

    scrollToBottom() {
        const chatContainer = document.querySelector('.chat-messages');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    checkNewMessages() {
        console.log('检查新消息...');
    }

    syncOfflineMessages() {
        console.log('同步离线消息...');
    }
}

// 创建全局实例
const enhancedMobileService = new EnhancedMobileCustomerService();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    enhancedMobileService.init();
});

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedMobileCustomerService;
}