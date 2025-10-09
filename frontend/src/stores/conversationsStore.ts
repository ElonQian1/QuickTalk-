import { create } from 'zustand';

type UnreadMap = Record<number, number>; // shopId -> unreadCount

interface ConversationsState {
  unreads: UnreadMap;
  totalUnread: number;
  // 设置某店铺未读（用于首次加载统计结果）
  setShopUnread: (shopId: number, count: number) => void;
  // 批量设置（初始化多店铺）
  setManyUnreads: (items: { shopId: number; count: number }[]) => void;
  // 某店铺未读 +1（收到新消息，且来自客户）
  incrementUnread: (shopId: number, delta?: number) => void;
  // 重置某店铺未读（例如进入该店铺客户列表/会话后已读）
  resetShopUnread: (shopId: number) => void;
  // 清空（登出等）
  resetAll: () => void;
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  unreads: {},
  totalUnread: 0,

  setShopUnread: (shopId, count) => {
    set((state) => {
      const prev = state.unreads[shopId] || 0;
      const nextUnreads = { ...state.unreads, [shopId]: count };
      const totalUnread = state.totalUnread - prev + count;
      return { unreads: nextUnreads, totalUnread };
    });
  },

  setManyUnreads: (items) => {
    set(() => {
      const unreads: UnreadMap = {};
      let totalUnread = 0;
      for (const it of items) {
        unreads[it.shopId] = it.count;
        totalUnread += it.count;
      }
      return { unreads, totalUnread };
    });
  },

  incrementUnread: (shopId, delta = 1) => {
    set((state) => {
      const current = state.unreads[shopId] || 0;
      const next = current + delta;
      return {
        unreads: { ...state.unreads, [shopId]: next },
        totalUnread: state.totalUnread + delta,
      };
    });
  },

  resetShopUnread: (shopId) => {
    set((state) => {
      const current = state.unreads[shopId] || 0;
      if (current === 0) return state;
      const nextUnreads = { ...state.unreads, [shopId]: 0 };
      return { unreads: nextUnreads, totalUnread: Math.max(0, state.totalUnread - current) };
    });
  },

  resetAll: () => set({ unreads: {}, totalUnread: 0 }),
}));
