import React from 'react';
import styled from 'styled-components';

// 文本内容组件的样式
const FormattedTextContainer = styled.div`
  white-space: pre-wrap; /* 保留换行符和空格 */
  word-wrap: break-word; /* 长单词换行 */
  line-height: 1.4;
  
  /* 链接样式 */
  a {
    color: #1976d2;
    text-decoration: underline;
    cursor: pointer;
    
    &:hover {
      color: #1565c0;
    }
  }
`;

// 大号表情显示组件
const EmojiOnlyContainer = styled.div`
  font-size: 32px;
  line-height: 1;
  padding: 4px 0;
  text-align: center;
  min-width: 40px;
`;

// 表情数据
const EMOJI_LIST = [
  '😊', '😂', '😁', '😍', '🤔', '😎', '😢', '😮', '😴', '😵',
  '👋', '👍', '👎', '👌', '✌️', '🤝', '👏', '🙏', '💪', '🤞',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💖',
  '🎉', '🎊', '🎈', '🎁', '🎂', '⭐', '✨', '💎', '💫', '🌟'
];

/**
 * 检测是否为纯表情消息
 */
export const isEmojiOnlyMessage = (content: string): boolean => {
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
};

/**
 * 将URL转换为可点击的链接
 */
export const linkifyText = (text: string): string => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
};

/**
 * 格式化文本内容，处理换行、链接等
 */
export const formatMessageContent = (content: string): string => {
  if (!content) return '';
  
  // 1. 处理换行符（保留）
  // 2. 处理链接
  let formatted = linkifyText(content);
  
  return formatted;
};

/**
 * 文本消息组件 - 用于React组件中
 */
interface MessageTextProps {
  content: string;
  className?: string;
}

export const MessageText: React.FC<MessageTextProps> = ({ content, className }) => {
  console.log('🔍 MessageText 收到内容:', { content, type: typeof content, length: content?.length });
  
  if (!content) {
    console.log('⚠️ MessageText 内容为空，返回null');
    return null;
  }
  
  // 临时测试：强制显示内容
  console.log('✅ MessageText 将渲染内容:', content);
  
  // 检查是否为纯表情消息
  if (isEmojiOnlyMessage(content)) {
    return (
      <EmojiOnlyContainer className={className}>
        {content}
      </EmojiOnlyContainer>
    );
  }
  
  // 格式化文本内容
  const formattedContent = formatMessageContent(content);
  console.log('🎨 格式化后的内容:', formattedContent);
  
  return (
    <FormattedTextContainer 
      className={className}
      dangerouslySetInnerHTML={{ __html: formattedContent }}
    />
  );
};

/**
 * 为原生DOM元素设置格式化文本内容 - 用于SDK中
 */
export const setFormattedTextContent = (element: HTMLElement, content: string): void => {
  if (!content) {
    element.textContent = '';
    return;
  }
  
  // 检查是否为纯表情消息
  if (isEmojiOnlyMessage(content)) {
    element.innerHTML = content;
    element.style.fontSize = '24px';
    element.style.lineHeight = '1';
    element.style.textAlign = 'center';
    element.style.padding = '4px 0';
    return;
  }
  
  // 设置样式以保留换行符
  element.style.whiteSpace = 'pre-wrap';
  element.style.wordWrap = 'break-word';
  element.style.lineHeight = '1.4';
  
  // 格式化内容并设置
  const formattedContent = formatMessageContent(content);
  element.innerHTML = formattedContent;
};

/**
 * 导出常用表情列表
 */
export { EMOJI_LIST };

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