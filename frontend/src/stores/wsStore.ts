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
  // 简单双写去重：key -> lastSeenEpochMs
  dedupCache: Record<string, number>;
  reconnectAttempts?: number;
  reconnectTimer?: any;
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
  dedupCache: {},
  reconnectAttempts: 0,
  reconnectTimer: undefined,

  connect: (shopId: number) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    // 避免重复连接
    const existing = get().socket;
    if (existing && get().status === 'connected' && get().activeShopId === shopId) {
      return;
    }

    if (existing) {
      try {
        // 先移除回调，避免关闭过程中的残余消息触发
        existing.onopen = null as any;
        existing.onmessage = null as any;
        existing.onerror = null as any;
        existing.onclose = null as any;
      } catch {}
      try { existing.close(); } catch {}
    }

    // 清理重连定时器，避免并发连接
    const prevTimer = get().reconnectTimer;
    if (prevTimer) {
      clearTimeout(prevTimer);
      set({ reconnectTimer: undefined });
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
      set({ status: 'connected', reconnectAttempts: 0 });
      console.log('✅ WebSocket 连接已建立并认证');
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const type = data.messageType as string;
        console.log('🔄 wsStore接收到消息:', { type, data });
        
        // 事件级去重：仅针对 new_message，避免重复广播/重连叠加
        if (type === 'new_message') {
          const now = Date.now();
          const sess = data.session_id || data.sessionId || '';
          const senderType = data.sender_type || data.senderType || '';
          const content = data.content || '';
          const fileUrl = data.file_url || data.fileUrl || '';
          const fileName = data.file_name || data.fileName || '';
          const key = `${sess}|${senderType}|${content}|${fileUrl}|${fileName}`;
          const cache = get().dedupCache;
          // 清理过期项（>10s）
          for (const k in cache) {
            if (now - cache[k] > 10000) delete cache[k];
          }
          if (cache[key] && now - cache[key] < 3000) {
            // 3 秒内重复，丢弃
            return;
          }
          cache[key] = now;
          set({ dedupCache: { ...cache } });
        }

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
      const { activeShopId, reconnectAttempts } = get();
      set({ status: 'disconnected', socket: undefined });
      console.log('🔌 WebSocket 连接已关闭');

      // 自动重连：当仍有激活的 shop 时尝试重连（指数退避，最大 30s）
      if (activeShopId) {
        const attempts = (reconnectAttempts || 0) + 1;
        const delay = Math.min(30000, 1000 * Math.pow(2, attempts - 1));
        const timer = setTimeout(() => {
          try {
            get().connect(activeShopId);
          } catch (e) {
            console.warn('⚠️ WebSocket 自动重连失败，即将再次尝试:', e);
          }
        }, delay);
        set({ reconnectAttempts: attempts, reconnectTimer: timer });
      }
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
