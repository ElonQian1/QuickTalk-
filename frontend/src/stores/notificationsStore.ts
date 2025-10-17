import { create } from 'zustand';

// 统一的未读通知中心：按店铺/会话维度统计
// 注意：为安全渐进迁移，暂不移除旧的 conversationsStore，二者可并行更新

type CountMap = Record<number, number>;

interface NotificationsState {
  // 维度统计
  byShop: CountMap;        // shopId -> unread
  bySession: CountMap;     // sessionId -> unread

  // 计算/选择器（轻量，直接从状态推导）
  totalUnread: number;
  getShopUnread: (shopId: number) => number;
  getSessionUnread: (sessionId: number) => number;

  // 初始化/批量
  setManyShopUnreads: (items: { shopId: number; count: number }[]) => void;
  setShopUnread: (shopId: number, count: number) => void;
  setSessionUnread: (sessionId: number, count: number, shopId?: number) => void;

  // 递增/清零
  incrementShopUnread: (shopId: number, delta?: number) => void;
  incrementSessionUnread: (sessionId: number, delta?: number, shopId?: number) => void;
  resetSessionUnread: (sessionId: number, shopId?: number) => void;
  resetShopUnread: (shopId: number) => void;
  resetAll: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  byShop: {},
  bySession: {},

  totalUnread: 0,
  getShopUnread: (shopId) => get().byShop[shopId] || 0,
  getSessionUnread: (sessionId) => get().bySession[sessionId] || 0,

  setManyShopUnreads: (items) => {
    set(() => {
      const byShop: CountMap = {};
      let total = 0;
      for (const it of items) {
        byShop[it.shopId] = it.count;
        total += it.count;
      }
      return { byShop, totalUnread: total } as Partial<NotificationsState>;
    });
  },

  setShopUnread: (shopId, count) => {
    set((state) => {
      const prev = state.byShop[shopId] || 0;
      const nextByShop = { ...state.byShop, [shopId]: count };
      const totalUnread = Math.max(0, state.totalUnread - prev + count);
      return { byShop: nextByShop, totalUnread } as Partial<NotificationsState>;
    });
  },

  setSessionUnread: (sessionId, count, shopId) => {
    set((state) => {
      const prevSession = state.bySession[sessionId] || 0;
      const nextBySession = { ...state.bySession, [sessionId]: count };
      let delta = count - prevSession;

      let nextByShop = state.byShop;
      if (shopId) {
        const prevShop = state.byShop[shopId] || 0;
        nextByShop = { ...state.byShop, [shopId]: Math.max(0, prevShop + delta) };
      }

      return {
        bySession: nextBySession,
        byShop: nextByShop,
        totalUnread: Math.max(0, state.totalUnread + delta),
      } as Partial<NotificationsState>;
    });
  },

  incrementSessionUnread: (sessionId, delta = 1, shopId) => {
    set((state) => {
      const current = state.bySession[sessionId] || 0;
      const nextBySession = { ...state.bySession, [sessionId]: current + delta };

      let nextByShop = state.byShop;
      if (shopId) {
        const s = state.byShop[shopId] || 0;
        nextByShop = { ...state.byShop, [shopId]: s + delta };
      }

      return {
        bySession: nextBySession,
        byShop: nextByShop,
        totalUnread: state.totalUnread + delta,
      } as Partial<NotificationsState>;
    });
  },

  incrementShopUnread: (shopId, delta = 1) => {
    set((state) => {
      const s = state.byShop[shopId] || 0;
      return {
        byShop: { ...state.byShop, [shopId]: s + delta },
        totalUnread: state.totalUnread + delta,
      } as Partial<NotificationsState>;
    });
  },

  resetSessionUnread: (sessionId, shopId) => {
    set((state) => {
      const current = state.bySession[sessionId] || 0;
      if (current === 0) return state;

      const nextBySession = { ...state.bySession };
      delete nextBySession[sessionId];

      let nextByShop = state.byShop;
      if (shopId) {
        const s = state.byShop[shopId] || 0;
        nextByShop = { ...state.byShop, [shopId]: Math.max(0, s - current) };
      }

      return {
        bySession: nextBySession,
        byShop: nextByShop,
        totalUnread: Math.max(0, state.totalUnread - current),
      } as Partial<NotificationsState>;
    });
  },

  resetShopUnread: (shopId) => {
    set((state) => {
      const shopCount = state.byShop[shopId] || 0;
      if (shopCount === 0) return state;

      // 按会话维度把该店铺的计数抹掉（调用方应传入对应会话进行 resetSessionUnread 更准确）
      // 这里做一个近似：只扣总数与店铺总数
      const nextByShop = { ...state.byShop, [shopId]: 0 };
      return {
        byShop: nextByShop,
        totalUnread: Math.max(0, state.totalUnread - shopCount),
      } as Partial<NotificationsState>;
    });
  },

  resetAll: () => set({ byShop: {}, bySession: {}, totalUnread: 0 }),
}));
