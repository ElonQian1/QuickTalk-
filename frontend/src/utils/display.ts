export function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return '未知';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return '刚刚';
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}小时前`;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  } catch {
    return '未知';
  }
}

type MessageLike = {
  message_type?: string | null;
  content?: string | null;
  file_name?: string | null;
};

export function formatMessagePreview(msg?: MessageLike | null): string {
  if (!msg) return '';
  const type = (msg.message_type || '').toLowerCase();
  const content = msg.content || '';
  if (type === 'text') return content;
  if (type === 'image') return '[图片]';
  if (type === 'file') return '[文件]';
  // 当没有类型但有内容，按文本兜底
  if (content) return content;
  return '[消息]';
}

// 客户信息类型（与后端 Customer 模型对应）
type CustomerInfo = {
  customer_id?: string;
  customer_name?: string | null;
  customer_email?: string | null;
};

/**
 * 获取客户显示名称（统一的命名规则）
 * 优先级：customer_name > customer_email > 用户{customer_id后4位}
 */
export function getCustomerDisplayName(customer?: CustomerInfo | null): string {
  if (!customer) return '未知客户';
  
  // 优先显示客户名称
  if (customer.customer_name?.trim()) {
    return customer.customer_name.trim();
  }
  
  // 其次显示邮箱
  if (customer.customer_email?.trim()) {
    return customer.customer_email.trim();
  }
  
  // 最后使用 customer_id 的后4位
  if (customer.customer_id) {
    const id = customer.customer_id;
    return `用户${id.slice(-Math.min(4, id.length))}`;
  }
  
  return '未知客户';
}
