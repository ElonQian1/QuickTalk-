import { api } from '../config/api';

export interface ShopItem {
  id: number;
  shop_name: string;
  shop_url?: string | null;
  api_key: string;
  created_at: string;
  unread_count: number;
}

export interface ShopWithUnreadResp { shop: ShopItem; unread_count: number; }

// 店主的店铺列表
export async function listOwnerShops(): Promise<ShopItem[]> {
  const res = await api.get<ShopWithUnreadResp[]>('/api/shops');
  return res.data.map(x => ({ ...x.shop, unread_count: x.unread_count }));
}

// 员工可访问的店铺列表
export async function listStaffShops(): Promise<ShopItem[]> {
  const res = await api.get<ShopWithUnreadResp[]>('/api/staff/shops');
  return res.data.map(x => ({ ...x.shop, unread_count: x.unread_count }));
}
