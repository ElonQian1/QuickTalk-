// 消息类型定义
export interface ChatMessage {
  id?: number;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  senderId?: number;
  senderType: 'customer' | 'staff';
  timestamp: Date;
  sessionId?: number;
  fileUrl?: string;
}

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
  serverUrl: string;
  apiKey: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerAvatar?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
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

  constructor(config: SDKConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...config,
    };

    // 初始化事件监听器映射
    ['connected', 'disconnected', 'message', 'typing', 'error', 'reconnecting', 'staffOnline', 'staffOffline'].forEach(eventType => {
      this.eventListeners.set(eventType as EventType, []);
    });
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
      const wsUrl = this.buildWebSocketUrl();
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
  public sendMessage(content: string, messageType: 'text' | 'image' | 'file' = 'text', fileUrl?: string): void {
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
        fileUrl,
      }
    };

    this.ws.send(JSON.stringify(message));
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
      const response = await fetch(`${this.config.serverUrl.replace('ws', 'http')}/api/sessions/${this.sessionId}/messages?limit=${limit}&offset=${offset}`, {
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

  private buildWebSocketUrl(): string {
    const baseUrl = this.config.serverUrl.replace(/^http/, 'ws');
    return `${baseUrl}/ws/customer/${this.config.apiKey}/${this.config.customerId}`;
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