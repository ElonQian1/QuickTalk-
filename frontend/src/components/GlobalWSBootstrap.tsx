import React, { useEffect } from 'react';
import { useWSStore } from '../stores/wsStore';
import { useAuthStore } from '../stores/authStore';
import { listOwnerShops, listStaffShops, ShopItem } from '../services/shops';
import { useNotificationsStore } from '../stores/notificationsStore';

// Purpose: 应用启动后的全局引导，负责：
// 1) 选择一个可用店铺建立 WebSocket 连接，确保前端任何页面都能接收消息广播
// 2) 初始化店铺维度的未读统计，驱动底部导航红点显示
// Errors: 网络失败时静默，不阻断应用

const GlobalWSBootstrap: React.FC = () => {
  const { user, hydrated } = useAuthStore();
  const connect = useWSStore(state => state.connect);
  const setManyShopUnreads = useNotificationsStore(state => state.setManyShopUnreads);

  useEffect(() => {
    if (!hydrated || !user) return;

    const run = async () => {
      try {
        // 拉取店主与员工的店铺，做一次合并与去重
        const [owner, staff] = await Promise.allSettled([
          listOwnerShops(),
          listStaffShops(),
        ]);

        const all: ShopItem[] = [];
        if (owner.status === 'fulfilled') all.push(...owner.value);
        if (staff.status === 'fulfilled') all.push(...staff.value);

        // 去重：按 shopId 合并，未读取最大值（避免重复叠加）
        const byId = new Map<number, ShopItem>();
        for (const s of all) {
          const prev = byId.get(s.id);
          if (!prev) byId.set(s.id, s);
          else byId.set(s.id, { ...s, unread_count: Math.max(prev.unread_count || 0, s.unread_count || 0) });
        }

        const merged = Array.from(byId.values());
        if (merged.length > 0) {
          // 初始化店铺维度未读统计
          setManyShopUnreads(merged.map(m => ({ shopId: m.id, count: m.unread_count || 0 })));

          // 建立一个基础的全局 WS 连接，选择第一个店铺作为 activeShopId
          // 说明：当前后端认证需要 shopId，当后续切换店铺或进入会话时会自动重连到对应 shopId
          connect(merged[0].id);
        }
      } catch (e) {
        // 静默失败：不阻断应用
        console.debug('GlobalWSBootstrap 初始化失败（忽略）:', e);
      }
    };

    run();
    // 仅在会话初始化后执行一次
  }, [hydrated, user, connect, setManyShopUnreads]);

  return null;
};

export default GlobalWSBootstrap;
