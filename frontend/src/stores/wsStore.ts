import { create } from 'zustand';
import { staffSocket } from '../config/ws';
import { useAuthStore } from './authStore';
import { useConversationsStore } from './conversationsStore';

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// 消息监听器类型定义
type MessageListener = (data: any) => void;

interface WSState {
  status: WSStatus;
  socket?: WebSocket;
  activeShopId?: number;
  messageListeners: MessageListener[];
  connect: (shopId: number) => void;
  disconnect: () => void;
  addMessageListener: (listener: MessageListener) => void;
  removeMessageListener: (listener: MessageListener) => void;
}

export const useWSStore = create<WSState>((set, get) => ({
  status: 'disconnected',
  socket: undefined,
  activeShopId: undefined,
  messageListeners: [],

  connect: (shopId: number) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    // 避免重复连接
    const existing = get().socket;
    if (existing && get().status === 'connected' && get().activeShopId === shopId) {
      return;
    }

    if (existing) {
      try { existing.close(); } catch {}
    }

    set({ status: 'connecting', activeShopId: shopId });
    const ws = staffSocket(String(user.id));

    ws.onopen = () => {
      // 发送 staff auth，附带 shopId
      const authMsg = {
        messageType: 'auth',
        metadata: { shopId },
      };
      ws.send(JSON.stringify(authMsg));
      set({ status: 'connected' });
      console.log('✅ WebSocket 连接已建立并认证');
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const type = data.messageType as string;
        console.log('🔄 wsStore接收到消息:', { type, data });
        
        // 立即分发给所有监听器
        const currentState = get();
        console.log('📋 当前监听器数量:', currentState.messageListeners.length);
        
        currentState.messageListeners.forEach((listener, index) => {
          try {
            console.log(`📤 分发消息给监听器 ${index}:`, data);
            listener(data);
          } catch (error) {
            console.error(`❌ 监听器 ${index} 处理失败:`, error);
          }
        });
        
        // 分发到全局会话 store
        if (type === 'new_message') {
          // 仅客户发来的消息计入未读
          const senderType = (data.senderType || data.sender_type) as string | undefined;
          const shopId = currentState.activeShopId;
          console.log('📊 更新未读计数:', { shopId, senderType });
          if (shopId && senderType === 'customer') {
            useConversationsStore.getState().incrementUnread(shopId, 1);
          }
        } else if (type === 'typing') {
          // typing 事件可在未来用于 UI 提示，这里暂不处理
        }
      } catch (e) {
        console.error('❌ wsStore消息处理失败:', e);
      }
    };

    ws.onerror = () => {
      set({ status: 'error' });
      console.error('❌ WebSocket 连接错误');
    };

    ws.onclose = () => {
      set({ status: 'disconnected', socket: undefined });
      console.log('🔌 WebSocket 连接已关闭');
    };

    set({ socket: ws });
  },

  disconnect: () => {
    const sock = get().socket;
    if (sock) {
      try { sock.close(); } catch {}
    }
    set({ socket: undefined, status: 'disconnected', activeShopId: undefined });
  },

  addMessageListener: (listener: MessageListener) => {
    const { messageListeners } = get();
    // 避免重复添加
    if (messageListeners.includes(listener)) {
      console.log('⚠️ 监听器已存在，跳过添加');
      return;
    }
    const newListeners = [...messageListeners, listener];
    set({ messageListeners: newListeners });
    console.log('✅ 消息监听器已添加，当前数量:', newListeners.length);
  },

  removeMessageListener: (listener: MessageListener) => {
    const { messageListeners } = get();
    const newListeners = messageListeners.filter(l => l !== listener);
    set({ messageListeners: newListeners });
    console.log('🗑️ 消息监听器已移除，当前数量:', newListeners.length);
  },
}));
