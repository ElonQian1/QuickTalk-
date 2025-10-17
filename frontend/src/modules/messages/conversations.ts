import { api } from '../../config/api';
import { normalizeShopsList } from '../../utils/normalize';
import { listStaffShops } from '../../services/shops';
import { sortConversations } from '../../utils/sort';

export interface Shop {
  id: number;
  shop_name: string;
  unread_count?: number;
  my_role?: 'owner' | 'staff';
}

export interface Conversation {
  shop: Shop;
  customer_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_type: string;
  } | null;
  unread_count: number;
}

// 加载“消息页”需要的会话列表：包含店主店铺与员工店铺
export async function loadConversationsForMessagesPage(): Promise<Conversation[]> {
  // 1) 获取“店主的店铺”和“员工店铺”
  const [ownerRes, staffList] = await Promise.all([
    api.get('/api/shops'),
    listStaffShops().catch(() => [] as any[]),
  ]);

  const ownerShops: Shop[] = (normalizeShopsList(ownerRes.data) as any[]).map((s: any) => ({
    id: s.id,
    shop_name: s.shop_name,
    unread_count: s.unread_count,
    my_role: 'owner',
  }));

  const staffShops: Shop[] = (staffList || []).map((s: any) => ({
    id: s.id,
    shop_name: s.shop_name,
    unread_count: s.unread_count,
    my_role: 'staff',
  }));

  // 合并去重
  const map = new Map<number, Shop>();
  [...ownerShops, ...staffShops].forEach(s => { if (!map.has(s.id)) map.set(s.id, s); });
  const shops = Array.from(map.values());

  // 2) 针对每个店铺获取客户概览，计算未读与最后一条
  const conversationData: Conversation[] = await Promise.all(
    shops.map(async (shop) => {
      try {
        const customersRes = await api.get(`/api/shops/${shop.id}/customers`);
        const customers = customersRes.data as any[];
        const unreadCount = customers.reduce((total: number, c: any) => total + (c.unread_count || 0), 0);

        // 计算该店铺的最近活跃时间与对应的最后一条消息
        let latestTs = 0;
        let latestMsg: { content: string; created_at: string; sender_type: string } | null = null;
        for (const c of customers) {
          const tStr = c?.last_message?.created_at || c?.session?.last_message_at || c?.customer?.last_active_at;
          if (!tStr) continue;
          const t = new Date(tStr).getTime();
          if (t > latestTs) {
            latestTs = t;
            latestMsg = c?.last_message ?? null;
          }
        }
        const lastMessage = latestMsg;
        return {
          shop: { ...shop, unread_count: unreadCount },
          customer_count: customers.length,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      } catch (e) {
        return {
          shop: { ...shop, unread_count: 0 },
          customer_count: 0,
          last_message: null,
          unread_count: 0,
        };
      }
    })
  );

  // 排序：按未读降序；其次按最近活跃时间（last_message.created_at 或 0）降序；再按客户数降序
  conversationData.sort((a, b) => sortConversations([a, b])[0] === a ? -1 : 1);

  return conversationData;
}
