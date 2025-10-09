import { api } from '../config/api';

export interface StaffItem {
  id: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role: string;
}

export async function listShopStaff(shopId: number) {
  const res = await api.get<StaffItem[]>(`/api/shops/${shopId}/staff`);
  return res.data;
}

export async function addShopStaff(shopId: number, username: string) {
  await api.post(`/api/shops/${shopId}/staff`, { username });
}

export async function removeShopStaff(shopId: number, userId: number) {
  await api.delete(`/api/shops/${shopId}/staff/${userId}`);
}
