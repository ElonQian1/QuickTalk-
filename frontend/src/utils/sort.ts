// 统一排序工具：
// - sortCustomers: 未读降序 -> 活跃时间（last_message.created_at | session.last_message_at | customer.last_active_at）降序
// - sortConversations: 未读降序 -> 最近消息时间降序 -> 客户数降序

type MaybeDateStr = string | undefined | null;

const toTs = (s: MaybeDateStr): number => {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
};

export type CustomerWithSessionLike = {
  unread_count?: number;
  last_message?: { created_at?: string | null } | null;
  session?: { last_message_at?: string | null } | null;
  customer: { last_active_at?: string | null };
};

export function sortCustomers<T extends CustomerWithSessionLike>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
    if (unreadDiff !== 0) return unreadDiff;
    const aTime = toTs(a.last_message?.created_at) || toTs(a.session?.last_message_at) || toTs(a.customer?.last_active_at);
    const bTime = toTs(b.last_message?.created_at) || toTs(b.session?.last_message_at) || toTs(b.customer?.last_active_at);
    return bTime - aTime;
  });
}

export type ConversationLike = {
  unread_count?: number;
  last_message?: { created_at?: string | null } | null;
  customer_count?: number;
};

export function sortConversations<T extends ConversationLike>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
    if (unreadDiff !== 0) return unreadDiff;
    const at = toTs(a.last_message?.created_at);
    const bt = toTs(b.last_message?.created_at);
    if (bt !== at) return bt - at;
    return (b.customer_count || 0) - (a.customer_count || 0);
  });
}
