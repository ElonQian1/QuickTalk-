/**
 * WebSocket 客户端模块
 * 负责WebSocket连接管理、消息处理、文件上传
 */

import { ConfigManager, ServerConfig } from '../core/config';

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

export interface WebSocketMessage {
  messageType: string;
  content?: string;
  sessionId?: number;
  senderId?: number;
  senderType?: string;
  timestamp?: Date;
  metadata?: any;
  file_url?: string;      // 保持下划线命名作为备用
  fileUrl?: string;       // 驼峰命名（Rust后端序列化后的实际字段名）
  file_name?: string;     // 保持下划线命名作为备用
  fileName?: string;      // 驼峰命名（Rust后端序列化后的实际字段名）
}

export type MessageHandler = (message: ChatMessage) => void;
export type ConnectionHandler = (config: ServerConfig) => void;
export type ErrorHandler = (error: Error) => void;
export type DisconnectHandler = () => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private shopId: string;
  private customerId: string;
  private serverConfig: ServerConfig | null = null;
  private configManager: ConfigManager;
  
  // 事件处理器
  private messageHandlers: MessageHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];

  /**
   * 协议适配工具函数 - 统一的协议适配策略
   */
  private adaptUrlProtocol(url: string): string {
    if (!url || typeof url !== 'string') {
      return url;
    }
    
    // 如果是相对路径、数据URL或已经是HTTPS，直接返回
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('https://')) {
      return url;
    }
    
    // 判断是否为开发环境：当前页面域名是localhost或127.0.0.1
    const isCurrentHostDev = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
    
    // 判断目标URL是否为localhost开发服务器
    const isTargetLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
    
    // 如果当前页面是HTTPS且URL是HTTP，需要转换
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      // 特殊处理：如果目标是localhost开发服务器，保持HTTP避免SSL错误
      if (isTargetLocalhost) {
        console.log('🔧 WebSocketClient检测到localhost开发服务器，保持HTTP:', { 
          url, 
          currentProtocol: window.location.protocol,
          currentHost: window.location.hostname,
          reason: 'localhost开发服务器通常不支持HTTPS，保持HTTP以避免SSL错误'
        });
        return url;
      }
      
      // 生产环境HTTPS页面访问外部HTTP资源，需要转换
      const adaptedUrl = url.replace('http://', 'https://');
      console.log('🔧 WebSocketClient协议适配:', { 
        original: url, 
        adapted: adaptedUrl, 
        reason: 'HTTPS页面访问外部HTTP资源',
        currentHost: window.location.hostname,
        isCurrentHostDev,
        isTargetLocalhost
      });
      return adaptedUrl;
    }
    
    // HTTP页面或无需转换
    console.log('🔧 WebSocketClient URL保持原样:', { 
      url, 
      currentProtocol: window.location.protocol,
      currentHost: window.location.hostname,
      reason: 'HTTP页面或无需转换'
    });
    return url;
  }
  
  // 连接状态
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(shopId: string, customerId?: string) {
    this.shopId = shopId;
    this.configManager = ConfigManager.getInstance();
    this.customerId = customerId || this.generateCustomerId();
  }

  /**
   * 生成随机客户ID
   */
  private generateCustomerId(): string {
    return this.configManager.generateCustomerId();
  }

  /**
   * 连接到WebSocket服务器
   */
  async connect(serverUrl?: string): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      // 获取服务器配置
      if (serverUrl) {
        // 使用指定的服务器地址
        this.serverConfig = {
          serverUrl,
          wsUrl: serverUrl.replace(/^https?/, serverUrl.startsWith('https') ? 'wss' : 'ws'),
          version: 'manual'
        };
      } else {
        // 自动检测服务器
        this.serverConfig = await this.configManager.findAvailableServer();
      }

      await this.connectWebSocket();
      
    } catch (error) {
      this.isConnecting = false;
      const errorMsg = error instanceof Error ? error.message : '连接失败';
      this.notifyError(new Error(`WebSocket连接失败: ${errorMsg}`));
      throw error;
    }
  }

  /**
   * 建立WebSocket连接
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.serverConfig) {
      throw new Error('服务器配置未找到');
    }

    // 构建WebSocket URL
    let wsUrl: string;
    if (this.serverConfig.endpoints?.websocket?.customer) {
      wsUrl = `${this.serverConfig.endpoints.websocket.customer}/${this.shopId}/${this.customerId}`;
    } else {
      const wsBase = this.serverConfig.wsUrl || 
        this.serverConfig.serverUrl.replace(/^https?/, this.serverConfig.serverUrl.startsWith('https') ? 'wss' : 'ws');
      wsUrl = `${wsBase}/ws/customer/${this.shopId}/${this.customerId}`;
    }

    console.log(`🔗 连接WebSocket: ${wsUrl}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket连接成功');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // 发送认证消息
          this.sendAuthMessage();
          
          // 通知连接成功
          this.notifyConnect(this.serverConfig!);
          
          // 开始版本检查
          this.configManager.checkForUpdates(this.serverConfig!.serverUrl);
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket连接关闭', event.code, event.reason);
          this.isConnecting = false;
          this.notifyDisconnect();
          
          // 如果不是正常关闭，尝试重连
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket错误:', error);
          this.isConnecting = false;
          this.notifyError(new Error('WebSocket连接错误'));
          reject(error);
        };

        // 连接超时处理
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket连接超时'));
          }
        }, 10000);

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 发送认证消息
   */
  private sendAuthMessage(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const authMessage = {
        messageType: 'auth',
        metadata: { 
          apiKey: this.shopId, 
          customerId: this.customerId 
        }
      };
      this.ws.send(JSON.stringify(authMessage));
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // 添加调试日志
      console.log('🔍 收到原始WebSocket消息:', {
        messageType: message.messageType,
        content: message.content,
        senderType: message.senderType,
        file_url: message.file_url,
        fileUrl: message.fileUrl, // 检查驼峰命名
        file_name: message.file_name,
        fileName: message.fileName,
        metadata: message.metadata
      });
      
      if (message.messageType === 'new_message' && message.content) {
        // 获取文件URL并进行协议适配
        const rawFileUrl = message.fileUrl || message.file_url;
        const adaptedFileUrl = rawFileUrl ? this.adaptUrlProtocol(rawFileUrl) : undefined;
        
        const chatMessage: ChatMessage = {
          content: message.content,
          messageType: (message.metadata?.messageType as ChatMessage['messageType']) || 'text',
          senderType: (message.senderType as ChatMessage['senderType']) || 'staff',
          timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
          fileUrl: adaptedFileUrl, // 使用协议适配后的URL
          fileName: message.fileName || message.file_name, // 优先使用驼峰命名，备用下划线命名
          sessionId: message.sessionId,
          senderId: message.senderId
        };

        // 添加解析后的消息调试日志
        console.log('📨 解析后的聊天消息:', {
          content: chatMessage.content,
          messageType: chatMessage.messageType,
          senderType: chatMessage.senderType,
          fileUrl: chatMessage.fileUrl,
          fileName: chatMessage.fileName
        });

        // 只处理来自客服人员的消息，忽略客户自己发送的消息回显
        if (chatMessage.senderType === 'staff') {
          console.log('✅ 处理客服消息');
          this.notifyMessage(chatMessage);
        } else {
          console.log('🔄 忽略客户消息回显:', chatMessage.content);
        }
      }
    } catch (error) {
      console.error('消息解析错误:', error);
    }
  }

  /**
   * 发送文本消息
   */
  sendMessage(content: string, messageType: ChatMessage['messageType'] = 'text'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket未连接，无法发送消息');
      return;
    }

    const messageData = {
      messageType: 'send_message',
      content,
      senderType: 'customer',
      metadata: { messageType }
    };

    this.ws.send(JSON.stringify(messageData));
    console.log('📤 发送消息:', content);
  }

  /**
   * 发送文件消息（图片、文件、语音等）
   */
  sendFileMessage(fileUrl: string, fileName: string, messageType: ChatMessage['messageType']): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket未连接，无法发送文件消息');
      return;
    }

    const messageData = {
      messageType: 'send_message',
      content: messageType === 'image' ? fileName : fileUrl, // 图片消息显示文件名，其他显示URL
      senderType: 'customer',
      metadata: { 
        messageType,
        mediaUrl: fileUrl, // 文件URL放在metadata中
        fileName: fileName
      }
    };

    this.ws.send(JSON.stringify(messageData));
    console.log('📤 发送文件消息:', { fileUrl, fileName, messageType });
  }

  /**
   * 上传文件
   */
  async uploadFile(file: File, messageType: ChatMessage['messageType'] = 'file'): Promise<{ url: string; fileName: string }> {
    if (!this.serverConfig) {
      throw new Error('服务器配置未加载');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('shopId', this.shopId);
    formData.append('messageType', messageType);
    formData.append('customerCode', this.customerId);

    // 构建上传URL
    const uploadUrl = this.serverConfig.endpoints?.upload || 
      `${this.serverConfig.serverUrl}/api/customer/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`上传失败: HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // 协议适配 - 确保URL协议与当前页面一致
      const adaptedUrl = this.adaptUrlProtocol(result.url);
      
      // 自动发送文件消息
      this.sendFileMessage(adaptedUrl, file.name, messageType);
      
      console.log('📎 文件上传成功:', { ...result, adaptedUrl });
      return {
        url: adaptedUrl,
        fileName: file.name
      };
    } catch (error) {
      console.error('📎 文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
    
    console.log(`🔄 ${delay}ms后尝试第${this.reconnectAttempts}次重连...`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect();
      } else {
        console.error('❌ 达到最大重连次数，停止重连');
        this.notifyError(new Error('连接失败，请刷新页面重试'));
      }
    }, delay);
  }

  /**
   * 手动重连
   */
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.configManager.clearCache(); // 清除配置缓存
    this.connect();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, '用户主动断开');
      this.ws = null;
    }
    this.isConnecting = false;
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }

  /**
   * 获取服务器配置
   */
  getServerConfig(): ServerConfig | null {
    return this.serverConfig;
  }

  /**
   * 获取客户ID
   */
  getCustomerId(): string {
    return this.customerId;
  }

  // 事件监听器管理
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnect(handler: ConnectionHandler): void {
    this.connectHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.push(handler);
  }

  // 移除事件监听器
  removeMessageHandler(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) this.messageHandlers.splice(index, 1);
  }

  removeConnectHandler(handler: ConnectionHandler): void {
    const index = this.connectHandlers.indexOf(handler);
    if (index > -1) this.connectHandlers.splice(index, 1);
  }

  removeErrorHandler(handler: ErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) this.errorHandlers.splice(index, 1);
  }

  removeDisconnectHandler(handler: DisconnectHandler): void {
    const index = this.disconnectHandlers.indexOf(handler);
    if (index > -1) this.disconnectHandlers.splice(index, 1);
  }

  // 事件通知方法
  private notifyMessage(message: ChatMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('消息处理器错误:', error);
      }
    });
  }

  private notifyConnect(config: ServerConfig): void {
    this.connectHandlers.forEach(handler => {
      try {
        handler(config);
      } catch (error) {
        console.error('连接处理器错误:', error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (error) {
        console.error('错误处理器错误:', error);
      }
    });
  }

  private notifyDisconnect(): void {
    this.disconnectHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('断开处理器错误:', error);
      }
    });
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.disconnect();
    this.messageHandlers = [];
    this.connectHandlers = [];
    this.errorHandlers = [];
    this.disconnectHandlers = [];
  }
}