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
export { VoicePlayer } from './voice-player';
export { VoiceMessageRenderer } from './voice-message';
export interface WebSocketMessage {
    messageType: string;
    content?: string;
    sessionId?: number;
    senderId?: number;
    senderType?: string;
    timestamp?: Date;
    metadata?: any;
}
export interface SDKConfig {
    serverUrl?: string;
    apiKey: string;
    customerId: string;
    customerName?: string;
    customerEmail?: string;
    customerAvatar?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    autoDetectServer?: boolean;
    enableAutoUpdate?: boolean;
    notification?: {
        enabled?: boolean;
        soundEnabled?: boolean;
        vibrationEnabled?: boolean;
        showBrowserNotification?: boolean;
        previewContentEnabled?: boolean;
        soundUrl?: string;
        soundVolume?: number;
        vibrationPattern?: number | number[];
    };
}
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
export type EventType = 'connected' | 'disconnected' | 'message' | 'typing' | 'error' | 'reconnecting' | 'staffOnline' | 'staffOffline';
export type EventListener = (data?: any) => void;
export interface StaffStatus {
    isOnline: boolean;
    lastSeen?: Date;
}
/**
 * 客服系统 WebSocket SDK
 * 供独立站前端集成使用
 */
export declare class CustomerServiceSDK {
    private config;
    private ws;
    private eventListeners;
    private reconnectAttempts;
    private reconnectTimer;
    private isConnecting;
    private sessionId;
    private serverConfig;
    private autoUpdater?;
    private readonly version;
    private notification?;
    constructor(config: SDKConfig);
    /**
     * 自动检测可用的服务器地址
     */
    private detectServerUrl;
    /**
     * 获取服务器URL
     */
    private getServerUrl;
    /**
     * 连接到服务器
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): void;
    /**
     * 初始化自动更新器
     */
    private initializeAutoUpdater;
    /**
     * 发送消息
     */
    sendMessage(content: string, messageType?: 'text' | 'image' | 'file' | 'voice', fileUrl?: string): void;
    /**
     * 上传文件并发送消息
     */
    uploadFile(file: File, messageType?: 'image' | 'file' | 'voice'): Promise<void>;
    /**
     * 上传语音文件
     */
    uploadVoice(audioBlob: Blob, fileName?: string): Promise<void>;
    /**
     * 上传图片
     */
    uploadImage(file: File): Promise<void>;
    /**
     * 发送打字状态
     */
    sendTyping(isTyping: boolean): void;
    /**
     * 获取历史消息
     */
    getMessageHistory(limit?: number, offset?: number): Promise<ChatMessage[]>;
    /**
     * 添加事件监听器
     */
    on(eventType: EventType, listener: EventListener): void;
    /**
     * 移除事件监听器
     */
    off(eventType: EventType, listener?: EventListener): void;
    /**
     * 检查连接状态
     */
    isConnected(): boolean;
    /**
     * 获取当前会话ID
     */
    getSessionId(): number | null;
    private buildWebSocketUrl;
    private handleOpen;
    private handleMessage;
    private handleClose;
    private handleError;
    private emit;
}
export declare function createCustomerServiceSDK(config: SDKConfig): CustomerServiceSDK;
export default CustomerServiceSDK;
declare global {
    interface Window {
        CustomerServiceSDK?: typeof CustomerServiceSDK;
        createCustomerServiceSDK?: typeof createCustomerServiceSDK;
    }
}
//# sourceMappingURL=index.d.ts.map