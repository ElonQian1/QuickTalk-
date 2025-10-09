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
    serverUrl: string;
    apiKey: string;
    customerId: string;
    customerName?: string;
    customerEmail?: string;
    customerAvatar?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
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
    constructor(config: SDKConfig);
    /**
     * 连接到服务器
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): void;
    /**
     * 发送消息
     */
    sendMessage(content: string, messageType?: 'text' | 'image' | 'file', fileUrl?: string): void;
    /**
     * 上传文件并发送消息
     */
    uploadFile(file: File, messageType?: 'image' | 'file'): Promise<void>;
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