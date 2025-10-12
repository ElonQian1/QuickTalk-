// SDK专用的文本格式化工具
// 不依赖React，可在纯JavaScript环境中使用

// 表情列表
const EMOJI_LIST = [
  '😊', '😂', '😁', '😍', '🤔', '😎', '😢', '😮', '😴', '😵',
  '👋', '👍', '👎', '👌', '✌️', '🤝', '👏', '🙏', '💪', '🤞',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💖',
  '🎉', '🎊', '🎈', '🎁', '🎂', '⭐', '✨', '💎', '💫', '🌟'
];

/**
 * 检测是否为纯表情消息
 */
export function isEmojiOnlyMessage(content: string): boolean {
  const trimmed = content.trim();
  
  // 长度检查
  if (trimmed.length === 0 || trimmed.length > 6) {
    return false;
  }
  
  // 检查是否为常见表情
  if (EMOJI_LIST.includes(trimmed)) {
    return true;
  }
  
  // 检查是否包含字母、数字或中文
  const hasAlphanumeric = /[a-zA-Z0-9\u4e00-\u9fff]/.test(trimmed);
  
  return !hasAlphanumeric;
}

/**
 * 将URL转换为可点击的链接
 */
export function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">$1</a>');
}

/**
 * 格式化文本内容，处理换行、链接等
 */
export function formatMessageContent(content: string): string {
  if (!content) return '';
  
  // 1. 处理链接
  let formatted = linkifyText(content);
  
  return formatted;
}

/**
 * 为DOM元素设置格式化文本内容
 */
export function setFormattedTextContent(element: HTMLElement, content: string): void {
  if (!content) {
    element.textContent = '';
    return;
  }
  
  // 检查是否为纯表情消息
  if (isEmojiOnlyMessage(content)) {
    element.innerHTML = content;
    element.style.fontSize = '28px';
    element.style.lineHeight = '1.2';
    element.style.textAlign = 'center';
    element.style.padding = '6px 0';
    element.style.minWidth = '40px';
    return;
  }
  
  // 设置样式以保留换行符
  element.style.whiteSpace = 'pre-wrap';
  element.style.wordWrap = 'break-word';
  element.style.lineHeight = '1.4';
  
  // 格式化内容并设置
  const formattedContent = formatMessageContent(content);
  element.innerHTML = formattedContent;
  
  // 为链接添加点击事件处理
  const links = element.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(link.getAttribute('href') || '', '_blank', 'noopener,noreferrer');
    });
  });
}

/**
 * 文本格式化工具类
 */
export const TextFormatter = {
  isEmojiOnly: isEmojiOnlyMessage,
  linkify: linkifyText,
  format: formatMessageContent,
  setDOMContent: setFormattedTextContent,
  emojiList: EMOJI_LIST
};