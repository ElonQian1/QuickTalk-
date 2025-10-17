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
