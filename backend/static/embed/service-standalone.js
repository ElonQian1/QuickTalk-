
/* QuickTalk SDK v2.0.0 - 模块化重构版本 */
/* 解决独立站样式覆盖问题，支持响应式字体和布局 */
(function() {
  'use strict';
  
  "use strict";
/**
 * QuickTalk SDK 主入口文件
 * 整合所有模块，提供统一的客服系统接口
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.QuickTalkSDK = void 0;
const websocket_client_1 = require("./core/websocket-client");
const style_system_1 = require("./ui/style-system");
const viewport_manager_1 = require("./ui/viewport-manager");
const ui_manager_1 = require("./ui/ui-manager");
const media_handler_1 = require("./media/media-handler");
const event_utils_1 = require("./utils/event-utils");
/**
 * QuickTalk 客服系统主类
 */
class QuickTalkSDK extends event_utils_1.EventEmitter {
    constructor(config) {
        super();
        this.wsClient = null;
        this.isInitialized = false;
        // 验证必要配置
        if (!config.shopId) {
            throw new Error('shopId is required');
        }
        this.config = {
            autoDetectServer: true,
            debugMode: false,
            ...config
        };
        // 初始化管理器
        this.uiManager = ui_manager_1.UIManager.getInstance();
        this.viewportManager = viewport_manager_1.ViewportManager.getInstance();
        this.styleSystem = style_system_1.StyleSystem.getInstance();
        this.mediaHandler = media_handler_1.MediaHandler.getInstance();
        this.voiceRecorder = new media_handler_1.VoiceRecorder();
        console.log(`🚀 QuickTalk SDK 初始化 - 店铺ID: ${this.config.shopId}`);
    }
    /**
     * 初始化SDK
     */
    async init() {
        if (this.isInitialized) {
            console.warn('SDK already initialized');
            return;
        }
        try {
            // 等待DOM准备
            await new Promise(resolve => (0, event_utils_1.onReady)(resolve));
            // 初始化WebSocket客户端
            this.wsClient = new websocket_client_1.WebSocketClient(this.config.shopId, this.config.customerId);
            // 创建UI
            const components = this.uiManager.createUI();
            // 绑定事件
            this.bindEvents();
            // 连接WebSocket
            await this.wsClient.connect(this.config.serverUrl);
            this.isInitialized = true;
            this.emit('ui-ready', undefined);
            console.log('✅ QuickTalk SDK 初始化完成');
            console.log(`📱 设备信息: ${this.viewportManager.getDeviceSummary()}`);
        }
        catch (error) {
            console.error('❌ SDK初始化失败:', error);
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * 绑定各种事件
     */
    bindEvents() {
        if (!this.wsClient)
            return;
        // WebSocket事件
        this.wsClient.onMessage((message) => {
            this.uiManager.addMessage(message);
            this.emit('message', message);
        });
        this.wsClient.onConnect((config) => {
            console.log('🔗 WebSocket连接成功:', config.serverUrl);
            this.emit('connected', { serverUrl: config.serverUrl });
        });
        this.wsClient.onDisconnect(() => {
            console.log('🔌 WebSocket连接断开');
            this.emit('disconnected', undefined);
        });
        this.wsClient.onError((error) => {
            console.error('❌ WebSocket错误:', error);
            this.emit('error', error);
        });
        // UI事件 - 发送消息
        document.addEventListener('qt-send-message', (event) => {
            const { content, messageType } = event.detail;
            this.sendMessage(content, messageType);
        });
        // UI事件 - 文件上传
        document.addEventListener('qt-upload-file', (event) => {
            const { file, messageType } = event.detail;
            this.uploadFile(file, messageType);
        });
    }
    /**
     * 发送消息
     */
    sendMessage(content, messageType = 'text') {
        if (!this.wsClient) {
            console.warn('WebSocket客户端未初始化');
            return;
        }
        // 添加到UI
        const message = {
            content,
            messageType,
            senderType: 'customer',
            timestamp: new Date()
        };
        this.uiManager.addMessage(message);
        // 通过WebSocket发送
        this.wsClient.sendMessage(content, messageType);
    }
    /**
     * 上传文件
     */
    async uploadFile(file, messageType = 'file') {
        if (!this.wsClient) {
            throw new Error('WebSocket客户端未初始化');
        }
        try {
            // 验证文件
            const validation = this.mediaHandler.validateFile(file, messageType);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            // 显示上传状态
            this.uiManager.showUploadStatus(`正在上传${messageType === 'image' ? '图片' : '文件'}...`);
            // 如果是图片且过大，进行压缩
            let processedFile = file;
            if (messageType === 'image' && file.size > 2 * 1024 * 1024) { // 2MB
                processedFile = await this.mediaHandler.compressImage(file, 0.8);
                console.log(`📷 图片已压缩: ${file.size} -> ${processedFile.size} bytes`);
            }
            // 上传文件
            const result = await this.wsClient.uploadFile(processedFile, messageType);
            this.emit('upload-complete', {
                url: result.url,
                fileName: result.fileName
            });
            console.log(`📎 文件上传成功: ${result.fileName}`);
        }
        catch (error) {
            console.error('📎 文件上传失败:', error);
            this.uiManager.showUploadStatus('文件上传失败');
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * 开始语音录制
     */
    async startVoiceRecording() {
        if (!this.voiceRecorder.isSupported()) {
            throw new Error('当前浏览器不支持语音录制');
        }
        try {
            await this.voiceRecorder.startRecording();
            this.uiManager.showUploadStatus('正在录制语音...');
        }
        catch (error) {
            console.error('🎤 语音录制启动失败:', error);
            throw error;
        }
    }
    /**
     * 停止语音录制并上传
     */
    async stopVoiceRecording() {
        try {
            const voiceFile = await this.voiceRecorder.stopRecording();
            await this.uploadFile(voiceFile, 'voice');
        }
        catch (error) {
            console.error('🎤 语音录制停止失败:', error);
            this.uiManager.showUploadStatus('语音录制失败');
            throw error;
        }
    }
    /**
     * 取消语音录制
     */
    cancelVoiceRecording() {
        this.voiceRecorder.cancelRecording();
        this.uiManager.showUploadStatus('语音录制已取消');
    }
    /**
     * 打开客服面板
     */
    open() {
        this.uiManager.open();
    }
    /**
     * 关闭客服面板
     */
    close() {
        this.uiManager.close();
    }
    /**
     * 切换客服面板显示状态
     */
    toggle() {
        this.uiManager.toggle();
    }
    /**
     * 重连WebSocket
     */
    reconnect() {
        if (this.wsClient) {
            this.wsClient.reconnect();
        }
    }
    /**
     * 获取连接状态
     */
    getConnectionState() {
        var _a;
        return ((_a = this.wsClient) === null || _a === void 0 ? void 0 : _a.getConnectionState()) || 'closed';
    }
    /**
     * 获取客户ID
     */
    getCustomerId() {
        var _a;
        return ((_a = this.wsClient) === null || _a === void 0 ? void 0 : _a.getCustomerId()) || '';
    }
    /**
     * 获取服务器配置
     */
    getServerConfig() {
        var _a;
        return (_a = this.wsClient) === null || _a === void 0 ? void 0 : _a.getServerConfig();
    }
    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        return this.viewportManager.getDeviceSummary();
    }
    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
        this.config.debugMode = enabled;
        if (enabled) {
            console.log('🔧 调试模式已启用');
            console.log('📊 当前状态:', {
                initialized: this.isInitialized,
                connected: this.getConnectionState(),
                customerId: this.getCustomerId(),
                device: this.getDeviceInfo()
            });
        }
    }
    /**
     * 销毁SDK实例
     */
    destroy() {
        console.log('🗑️ 销毁 QuickTalk SDK...');
        // 清理WebSocket
        if (this.wsClient) {
            this.wsClient.cleanup();
            this.wsClient = null;
        }
        // 清理UI
        this.uiManager.cleanup();
        // 清理语音录制
        this.voiceRecorder.cancelRecording();
        // 清理视口管理器
        this.viewportManager.cleanup();
        // 移除所有事件监听器
        this.removeAllListeners();
        this.isInitialized = false;
        console.log('✅ QuickTalk SDK 已清理');
    }
}
exports.QuickTalkSDK = QuickTalkSDK;
/**
 * 向后兼容的全局接口
 */
window.QuickTalkCustomerService = {
    /**
     * 简化的初始化接口（向后兼容）
     */
    init(config) {
        const sdk = new QuickTalkSDK(config);
        sdk.init().catch(error => {
            console.error('QuickTalk初始化失败:', error);
        });
    },
    /**
     * 完整SDK类的引用
     */
    SDK: QuickTalkSDK
};
// 默认导出
exports.default = QuickTalkSDK;
// 版本信息
exports.VERSION = '2.0.0';
console.log(`📦 QuickTalk SDK v${exports.VERSION} 已加载`);
console.log('🎯 功能特性:');
console.log('  • 智能服务器检测');
console.log('  • 响应式样式系统（防覆盖）');
console.log('  • 自适应字体和布局');
console.log('  • 文件上传（图片/文件/语音）');
console.log('  • 模块化架构');
console.log('  • TypeScript 支持');
//# sourceMappingURL=standalone-entry.js.map
  
  console.log('✅ QuickTalk SDK 2.0.0 已加载（独立版本）');
  console.log('🎯 重点改进:');
  console.log('  • 防止独立站样式覆盖');
  console.log('  • 响应式字体和窗口比例');
  console.log('  • 模块化架构重构');
  console.log('  • 更好的移动端适配');
})();
