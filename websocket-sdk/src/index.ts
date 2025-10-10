// 消息类型定义
export interface ChatMessage {
  id?: number;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'voice' | 'system';
  senderId?: number;
  senderType: 'customer' | 'staff';
  timestamp: Date;
  sessionId?: number;
  fileUrl?: string;
  fileName?: string;
}

// 导出语音相关组件
export { VoicePlayer } from './voice-player';
export { VoiceMessageRenderer } from './voice-message';

// WebSocket 消息格式
export interface WebSocketMessage {
  messageType: string;
  content?: string;
  sessionId?: number;
  senderId?: number;
  senderType?: string;
  timestamp?: Date;
  metadata?: any;
}

// SDK 配置
export interface SDKConfig {
  serverUrl?: string; // 改为可选，支持自动检测
  apiKey: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerAvatar?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoDetectServer?: boolean; // 是否启用自动服务器检测
}

// 服务器配置响应
export interface ServerConfig {
  version: string;
  serverUrl: string;
  wsUrl: string;
  config: {
    protocol: string;
    wsProtocol: string;
    configuredHost: string;
    configuredPort: string;
    detectedHost?: string;
    forwardedHost?: string;
    clientIp: string;
  };
  endpoints: {
    api: string;
    websocket: {
      customer: string;
      staff: string;
    };
    upload: string;
  };
  timestamp: number;
}

// 事件类型
export type EventType = 
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'typing'
  | 'error'
  | 'reconnecting'
  | 'staffOnline'
  | 'staffOffline';

// 事件监听器
export type EventListener = (data?: any) => void;

// 客服状态
export interface StaffStatus {
  isOnline: boolean;
  lastSeen?: Date;
}

/**
 * 客服系统 WebSocket SDK
 * 供独立站前端集成使用
 */
export class CustomerServiceSDK {
  private config: SDKConfig;
  private ws: WebSocket | null = null;
  private eventListeners: Map<EventType, EventListener[]> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private sessionId: number | null = null;
  private serverConfig: ServerConfig | null = null;

  constructor(config: SDKConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      autoDetectServer: true,
      ...config,
    };

    // 初始化事件监听器映射
    ['connected', 'disconnected', 'message', 'typing', 'error', 'reconnecting', 'staffOnline', 'staffOffline'].forEach(eventType => {
      this.eventListeners.set(eventType as EventType, []);
    });
  }

  /**
   * 自动检测可用的服务器地址
   */
  private async detectServerUrl(): Promise<ServerConfig> {
    const currentUrl = window.location;
    const candidates = [
      // 优先尝试当前域名的标准端口
      `${currentUrl.protocol}//${currentUrl.hostname}:8080`,
      // 尝试相同协议和端口
      `${currentUrl.protocol}//${currentUrl.host}`,
      // 开发环境后备选项
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    // 去重
    const uniqueCandidates = [...new Set(candidates)];

    for (const serverUrl of uniqueCandidates) {
      try {
        const response = await fetch(`${serverUrl}/api/config`, {
          method: 'GET',
          mode: 'cors',
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const config = await response.json() as ServerConfig;
          console.log('✅ 检测到可用服务器:', serverUrl);
          return config;
        }
      } catch (error) {
        console.warn(`❌ 服务器 ${serverUrl} 不可用:`, error);
      }
    }

    throw new Error('无法检测到可用的服务器地址');
  }

  /**
   * 获取服务器URL
   */
  private async getServerUrl(): Promise<string> {
    if (this.config.serverUrl) {
      return this.config.serverUrl;
    }

    if (this.config.autoDetectServer) {
      if (!this.serverConfig) {
        this.serverConfig = await this.detectServerUrl();
      }
      return this.serverConfig.serverUrl;
    }

    throw new Error('未配置服务器地址且未启用自动检测');
  }

  /**
   * 连接到服务器
   */
  public async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      const wsUrl = await this.buildWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      this.isConnecting = false;
      this.emit('error', { type: 'connection_failed', error });
      throw error;
    }
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * 发送消息
   */
  public sendMessage(content: string, messageType: 'text' | 'image' | 'file' | 'voice' = 'text', fileUrl?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message: WebSocketMessage = {
      messageType: 'send_message',
      content,
      senderType: 'customer',
      timestamp: new Date(),
      metadata: {
        messageType,
        mediaUrl: fileUrl, // 改用mediaUrl，与后端处理逻辑一致
        fileUrl, // 保留fileUrl以兼容
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 上传文件并发送消息
   */
  public async uploadFile(file: File, messageType: 'image' | 'file' | 'voice' = 'file'): Promise<void> {
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      const serverUrl = await this.getServerUrl();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shopId', this.config.apiKey); // 使用 apiKey 作为 shopId
      formData.append('messageType', messageType);
      formData.append('customerCode', this.config.customerId);

      const uploadUrl = this.serverConfig?.endpoints?.upload || `${serverUrl}/api/customer/upload`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      
      // 发送包含文件信息的消息
      this.sendMessage(uploadData.original_name, messageType, uploadData.url);
      
    } catch (error) {
      this.emit('error', { type: 'upload_error', error });
      throw error;
    }
  }

  /**
   * 上传语音文件
   */
  public async uploadVoice(audioBlob: Blob, fileName?: string): Promise<void> {
    const file = new File([audioBlob], fileName || `voice_${Date.now()}.webm`, { 
      type: audioBlob.type || 'audio/webm' 
    });
    
    return this.uploadFile(file, 'voice');
  }

  /**
   * 上传图片
   */
  public async uploadImage(file: File): Promise<void> {
    return this.uploadFile(file, 'image');
  }

  /**
   * 发送打字状态
   */
  public sendTyping(isTyping: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      messageType: 'typing',
      metadata: { isTyping }
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 获取历史消息
   */
  public async getMessageHistory(limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    try {
      const serverUrl = await this.getServerUrl();
      const apiUrl = this.serverConfig?.endpoints?.api || serverUrl;
      const response = await fetch(`${apiUrl}/sessions/${this.sessionId}/messages?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch message history');
      }

      return await response.json();
    } catch (error) {
      this.emit('error', { type: 'api_error', error });
      throw error;
    }
  }

  /**
   * 添加事件监听器
   */
  public on(eventType: EventType, listener: EventListener): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(listener);
    this.eventListeners.set(eventType, listeners);
  }

  /**
   * 移除事件监听器
   */
  public off(eventType: EventType, listener?: EventListener): void {
    if (!listener) {
      this.eventListeners.set(eventType, []);
      return;
    }

    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * 检查连接状态
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 获取当前会话ID
   */
  public getSessionId(): number | null {
    return this.sessionId;
  }

  // 私有方法

  private async buildWebSocketUrl(): Promise<string> {
    // 确保服务器配置已加载
    if (!this.serverConfig) {
      if (this.config.autoDetectServer) {
        this.serverConfig = await this.detectServerUrl();
      }
    }
    
    // 优先使用服务器配置中的 WebSocket 端点
    if (this.serverConfig?.endpoints?.websocket?.customer) {
      return `${this.serverConfig.endpoints.websocket.customer}/${this.config.apiKey}/${this.config.customerId}`;
    }
    
    // 兜底方案：从 serverUrl 构建
    const serverUrl = await this.getServerUrl();
    const wsUrl = serverUrl.replace(/^http/, 'ws');
    return `${wsUrl}/ws/customer/${this.config.apiKey}/${this.config.customerId}`;
  }

  private handleOpen(): void {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // 发送认证消息
    const authMessage: WebSocketMessage = {
      messageType: 'auth',
      metadata: {
        apiKey: this.config.apiKey,
        customerId: this.config.customerId,
        customerName: this.config.customerName,
        customerEmail: this.config.customerEmail,
        customerAvatar: this.config.customerAvatar,
      }
    };

    this.ws?.send(JSON.stringify(authMessage));
    this.emit('connected');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.messageType) {
        case 'auth_success':
          this.sessionId = message.sessionId || null;
          break;
          
        case 'new_message':
          this.emit('message', {
            id: message.metadata?.id,
            content: message.content,
            messageType: message.metadata?.messageType || 'text',
            senderId: message.senderId,
            senderType: message.senderType,
            timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
            sessionId: message.sessionId,
            fileUrl: message.metadata?.fileUrl,
          } as ChatMessage);
          break;
          
        case 'typing':
          this.emit('typing', {
            isTyping: message.metadata?.isTyping,
            senderId: message.senderId,
          });
          break;
          
        case 'staff_status':
          if (message.metadata?.isOnline) {
            this.emit('staffOnline', message.metadata);
          } else {
            this.emit('staffOffline', message.metadata);
          }
          break;
          
        default:
          console.warn('Unknown message type:', message.messageType);
      }
    } catch (error) {
      this.emit('error', { type: 'message_parse_error', error });
    }
  }

  private handleClose(): void {
    this.isConnecting = false;
    this.emit('disconnected');
    
    // 尝试重连
    if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(() => {
          // 重连失败，继续尝试
        });
      }, this.config.reconnectInterval);
    }
  }

  private handleError(error: Event): void {
    this.isConnecting = false;
    this.emit('error', { type: 'websocket_error', error });
  }

  private emit(eventType: EventType, data?: any): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }
}

// 导出默认实例创建函数
export function createCustomerServiceSDK(config: SDKConfig): CustomerServiceSDK {
  return new CustomerServiceSDK(config);
}

// 默认导出
export default CustomerServiceSDK;

declare global {
  interface Window {
    CustomerServiceSDK?: typeof CustomerServiceSDK;
    createCustomerServiceSDK?: typeof createCustomerServiceSDK;
  }
}

if (typeof window !== 'undefined') {
  window.CustomerServiceSDK = CustomerServiceSDK;
  window.createCustomerServiceSDK = createCustomerServiceSDK;
}