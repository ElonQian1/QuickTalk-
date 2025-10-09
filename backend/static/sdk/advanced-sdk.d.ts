/**
 * 高级客服聊天SDK - 支持多媒体消息
 * 功能：文本、图片、文件、语音消息
 * 一键集成到独立站
 */
export interface ChatMessage {
    id?: string;
    content: string;
    messageType: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
    senderId?: string;
    senderType: 'customer' | 'staff' | 'system';
    timestamp: Date;
    sessionId?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    thumbnail?: string;
    duration?: number;
    metadata?: {
        originalMessage?: string;
        replyTo?: string;
        mentions?: string[];
        isEncrypted?: boolean;
    };
}
export interface CustomerServiceConfig {
    serverUrl: string;
    shopId: string | number;
    customerId: string;
    customerName?: string;
    customerEmail?: string;
    customerAvatar?: string;
    features?: {
        enableFileUpload?: boolean;
        enableImageUpload?: boolean;
        enableAudioRecording?: boolean;
        enableVideoCall?: boolean;
        maxFileSize?: number;
        allowedFileTypes?: string[];
    };
    ui?: {
        theme?: 'light' | 'dark' | 'auto';
        primaryColor?: string;
        position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
        language?: 'zh-CN' | 'en-US' | 'ja-JP';
        showTypingIndicator?: boolean;
        showOnlineStatus?: boolean;
    };
    connection?: {
        reconnectInterval?: number;
        maxReconnectAttempts?: number;
        timeout?: number;
    };
    callbacks?: {
        onConnect?: () => void;
        onDisconnect?: () => void;
        onMessage?: (message: ChatMessage) => void;
        onError?: (error: Error) => void;
        onFileUploadProgress?: (progress: number) => void;
        onFileUploadComplete?: (fileUrl: string) => void;
    };
}
export type CustomerServiceEvent = 'connected' | 'disconnected' | 'message' | 'typing' | 'staff-online' | 'staff-offline' | 'error' | 'file-upload-progress' | 'file-upload-complete' | 'audio-recording-start' | 'audio-recording-stop';
/**
 * 高级客服聊天SDK主类
 */
export declare class AdvancedCustomerServiceSDK {
    private config;
    private ws;
    private eventListeners;
    private reconnectAttempts;
    private reconnectTimer;
    private isConnecting;
    private sessionId;
    private uploadEndpoint;
    private currentUploads;
    private mediaRecorder;
    private audioChunks;
    private isRecording;
    constructor(config: CustomerServiceConfig);
    /**
     * 连接到客服系统
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): void;
    /**
     * 发送文本消息
     */
    sendMessage(content: string): void;
    /**
     * 发送图片消息
     */
    sendImage(file: File): Promise<void>;
    /**
     * 发送文件消息
     */
    sendFile(file: File): Promise<void>;
    /**
     * 开始录音
     */
    startAudioRecording(): Promise<void>;
    /**
     * 停止录音
     */
    stopAudioRecording(): void;
    /**
     * 发送语音消息
     */
    private sendAudio;
    /**
     * 文件上传
     */
    private uploadFile;
    /**
     * 发送聊天消息（内部方法）
     */
    private sendChatMessage;
    /**
     * WebSocket事件处理
     */
    private handleOpen;
    private handleMessage;
    private handleClose;
    private handleError;
    /**
     * 发送认证消息
     */
    private sendAuthMessage;
    /**
     * 计划重连
     */
    private scheduleReconnect;
    /**
     * 初始化事件监听器映射
     */
    private initializeEventListeners;
    /**
     * 事件监听
     */
    on(event: CustomerServiceEvent, callback: Function): void;
    /**
     * 移除事件监听
     */
    off(event: CustomerServiceEvent, callback: Function): void;
    /**
     * 触发事件
     */
    private emit;
    /**
     * 创建聊天组件UI（可选的内置UI）
     */
    private createChatWidget;
    /**
     * 销毁SDK
     */
    destroy(): void;
}
export default AdvancedCustomerServiceSDK;
//# sourceMappingURL=advanced-sdk.d.ts.map