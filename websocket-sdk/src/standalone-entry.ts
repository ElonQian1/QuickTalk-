/**
 * QuickTalk SDK 主入口文件
 * 整合所有模块，提供统一的客服系统接口
 */

import { ConfigManager, SDKConfig } from './core/config';
import { WebSocketClient, ChatMessage } from './core/websocket-client';
import { StyleSystem } from './ui/style-system';
import { ViewportManager } from './ui/viewport-manager';
import { UIManager } from './ui/ui-manager';
import { ImageViewer } from './ui/image-viewer';
import { MediaHandler, VoiceRecorder } from './media/media-handler';
import { EventEmitter, onReady } from './utils/event-utils';

// 定义SDK事件映射
interface SDKEvents {
  'message': ChatMessage;
  'connected': { serverUrl: string };
  'disconnected': void;
  'error': Error;
  'ui-ready': void;
  'upload-progress': { percentage: number };
  'upload-complete': { url: string; fileName: string };
}

/**
 * QuickTalk 客服系统主类
 */
export class QuickTalkSDK extends EventEmitter<SDKEvents> {
  private config: SDKConfig;
  private wsClient: WebSocketClient | null = null;
  private uiManager: UIManager;
  private viewportManager: ViewportManager;
  private styleSystem: StyleSystem;
  private mediaHandler: MediaHandler;
  private voiceRecorder: VoiceRecorder;
  private isInitialized = false;

  constructor(config: SDKConfig) {
    super();
    
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
    this.uiManager = UIManager.getInstance();
    this.viewportManager = ViewportManager.getInstance();
    this.styleSystem = StyleSystem.getInstance();
    this.mediaHandler = MediaHandler.getInstance();
    this.voiceRecorder = new VoiceRecorder();
    
    // 确保ImageViewer被初始化
    ImageViewer.getInstance();

    console.log(`🚀 QuickTalk SDK 初始化 - 店铺ID: ${this.config.shopId}`);
  }

  /**
   * 初始化SDK
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('SDK already initialized');
      return;
    }

    try {
      // 等待DOM准备
      await new Promise<void>(resolve => onReady(resolve));

      // 初始化WebSocket客户端
      this.wsClient = new WebSocketClient(
        this.config.shopId, 
        this.config.customerId
      );

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
      
    } catch (error) {
      console.error('❌ SDK初始化失败:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 绑定各种事件
   */
  private bindEvents(): void {
    if (!this.wsClient) return;

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
    document.addEventListener('qt-send-message', (event: any) => {
      const { content, messageType } = event.detail;
      this.sendMessage(content, messageType);
    });

    // UI事件 - 文件上传
    document.addEventListener('qt-upload-file', (event: any) => {
      const { file, messageType } = event.detail;
      this.uploadFile(file, messageType);
    });
  }

  /**
   * 发送消息
   */
  sendMessage(content: string, messageType: ChatMessage['messageType'] = 'text'): void {
    if (!this.wsClient) {
      console.warn('WebSocket客户端未初始化');
      return;
    }

    // 添加到UI
    const message: ChatMessage = {
      content,
      messageType,
      senderType: 'customer',
      timestamp: new Date()
    };

    // 如果是文件或图片消息，设置fileUrl
    if (messageType === 'image' || messageType === 'file') {
      message.fileUrl = content;
      // 从URL中提取文件名
      const urlParts = content.split('/');
      message.fileName = urlParts[urlParts.length - 1];
    }

    this.uiManager.addMessage(message);

    // 通过WebSocket发送
    this.wsClient.sendMessage(content, messageType);
  }

  /**
   * 上传文件
   */
  async uploadFile(file: File, messageType: ChatMessage['messageType'] = 'file'): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket客户端未初始化');
    }

    try {
      // 验证文件
      const validation = this.mediaHandler.validateFile(file, messageType as any);
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
      
      // 清除上传状态
      this.uiManager.clearUploadStatus();
      
      // 注意：WebSocketClient.uploadFile已经自动发送了消息，这里只需要添加到界面
      const fileMessage: ChatMessage = {
        content: messageType === 'image' ? result.fileName : result.url, // 图片显示文件名，其他显示URL
        messageType,
        senderType: 'customer',
        timestamp: new Date(),
        fileUrl: result.url,
        fileName: result.fileName
      };
      
      // 添加文件消息到界面
      this.uiManager.addMessage(fileMessage);
      
      this.emit('upload-complete', { 
        url: result.url, 
        fileName: result.fileName 
      });

      console.log(`📎 文件上传成功: ${result.fileName}`);

    } catch (error) {
      console.error('📎 文件上传失败:', error);
      this.uiManager.showUploadStatus('文件上传失败');
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 开始语音录制
   */
  async startVoiceRecording(): Promise<void> {
    if (!this.voiceRecorder.isSupported()) {
      throw new Error('当前浏览器不支持语音录制');
    }

    try {
      await this.voiceRecorder.startRecording();
      this.uiManager.showUploadStatus('正在录制语音...');
    } catch (error) {
      console.error('🎤 语音录制启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止语音录制并上传
   */
  async stopVoiceRecording(): Promise<void> {
    try {
      const voiceFile = await this.voiceRecorder.stopRecording();
      await this.uploadFile(voiceFile, 'voice');
    } catch (error) {
      console.error('🎤 语音录制停止失败:', error);
      this.uiManager.showUploadStatus('语音录制失败');
      throw error;
    }
  }

  /**
   * 取消语音录制
   */
  cancelVoiceRecording(): void {
    this.voiceRecorder.cancelRecording();
    this.uiManager.showUploadStatus('语音录制已取消');
  }

  /**
   * 打开客服面板
   */
  open(): void {
    this.uiManager.open();
  }

  /**
   * 关闭客服面板
   */
  close(): void {
    this.uiManager.close();
  }

  /**
   * 切换客服面板显示状态
   */
  toggle(): void {
    this.uiManager.toggle();
  }

  /**
   * 重连WebSocket
   */
  reconnect(): void {
    if (this.wsClient) {
      this.wsClient.reconnect();
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    return this.wsClient?.getConnectionState() || 'closed';
  }

  /**
   * 获取客户ID
   */
  getCustomerId(): string {
    return this.wsClient?.getCustomerId() || '';
  }

  /**
   * 获取服务器配置
   */
  getServerConfig(): any {
    return this.wsClient?.getServerConfig();
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo(): string {
    return this.viewportManager.getDeviceSummary();
  }

  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void {
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
  destroy(): void {
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

// 全局接口 - 保持向后兼容
declare global {
  interface Window {
    QuickTalkCustomerService: {
      init(config: { shopId: string; serverUrl?: string; customerId?: string }): void;
      SDK: typeof QuickTalkSDK;
    };
  }
}

/**
 * 向后兼容的全局接口
 */
window.QuickTalkCustomerService = {
  /**
   * 简化的初始化接口（向后兼容）
   */
  init(config: { shopId: string; serverUrl?: string; customerId?: string }): void {
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
export default QuickTalkSDK;

// 版本信息
export const VERSION = '2.0.0';

console.log(`📦 QuickTalk SDK v${VERSION} 已加载`);
console.log('🎯 功能特性:');
console.log('  • 智能服务器检测');
console.log('  • 响应式样式系统（防覆盖）');
console.log('  • 自适应字体和布局');
console.log('  • 文件上传（图片/文件/语音）');
console.log('  • 模块化架构');
console.log('  • TypeScript 支持');