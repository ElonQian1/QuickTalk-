import { create } from 'zustand';
import { staffSocket } from '../config/ws';
import { useAuthStore } from './authStore';
import { useConversationsStore } from './conversationsStore';

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WSState {
  status: WSStatus;
  socket?: WebSocket;
  activeShopId?: number;
  connect: (shopId: number) => void;
  disconnect: () => void;
}

export const useWSStore = create<WSState>((set, get) => ({
  status: 'disconnected',
  socket: undefined,
  activeShopId: undefined,

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
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const type = data.messageType as string;
        // 分发到全局会话 store
        if (type === 'new_message') {
          // 仅客户发来的消息计入未读
          const senderType = (data.senderType || data.sender_type) as string | undefined;
          const state = get();
          const shopId = state.activeShopId;
          if (shopId && senderType === 'customer') {
            useConversationsStore.getState().incrementUnread(shopId, 1);
          }
        } else if (type === 'typing') {
          // typing 事件可在未来用于 UI 提示，这里暂不处理
        }
      } catch (e) {
        // ignore
      }
    };

    ws.onerror = () => {
      set({ status: 'error' });
    };

    ws.onclose = () => {
      set({ status: 'disconnected', socket: undefined });
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
}));
