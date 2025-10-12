import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/globalStyles';

// 表情数据分类
const emojiCategories = {
  smileys: {
    label: '😊',
    name: '笑脸',
    emojis: ['😊', '😂', '😁', '😍', '🤔', '😎', '😢', '😮', '😴', '😵']
  },
  gestures: {
    label: '👋',
    name: '手势',
    emojis: ['👋', '👍', '👎', '👌', '✌️', '🤝', '👏', '🙏', '💪', '🤞']
  },
  hearts: {
    label: '❤️',
    name: '爱心',
    emojis: ['❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💖']
  },
  celebration: {
    label: '🎉',
    name: '庆祝',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎂', '⭐', '✨', '💎', '💫', '🌟']
  }
};

const EmojiPickerContainer = styled.div<{ visible: boolean; top: number; left: number }>`
  position: fixed;
  top: ${props => props.top}px;
  left: ${props => props.left}px;
  width: 320px;
  max-height: 400px;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius}px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow-y: auto;
  padding: ${theme.spacing.md};
  display: ${props => props.visible ? 'block' : 'none'};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;

  @media (max-width: 768px) {
    width: 280px;
    max-height: 350px;
    padding: ${theme.spacing.sm};
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: ${theme.spacing.sm};
  right: ${theme.spacing.sm};
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: ${theme.colors.text.secondary};
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: ${theme.colors.background};
    color: ${theme.colors.text.primary};
  }
`;

const CategorySection = styled.div`
  margin-bottom: ${theme.spacing.md};
`;

const CategoryTitle = styled.div`
  font-size: 14px;
  margin-bottom: ${theme.spacing.xs};
  color: ${theme.colors.text.secondary};
  border-bottom: 1px solid ${theme.colors.border};
  padding-bottom: ${theme.spacing.xs};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const EmojiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: ${theme.spacing.sm};
  justify-items: center;

  @media (max-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
    gap: ${theme.spacing.xs};
  }
`;

const EmojiButton = styled.button`
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius}px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;

  &:hover {
    background: ${theme.colors.background};
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: 768px) {
    font-size: 20px;
    width: 36px;
    height: 36px;
  }
`;

interface EmojiPickerProps {
  visible: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onEmojiSelect,
  onClose,
  anchorRef
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);

  // 计算表情选择器位置
  const calculatePosition = () => {
    if (!anchorRef.current || !pickerRef.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let top = anchorRect.top - pickerRect.height - 8;
    let left = anchorRect.left;

    // 确保不超出视口上边界
    if (top < 8) {
      top = anchorRect.bottom + 8;
    }

    // 确保不超出视口右边界
    if (left + pickerRect.width + 16 > viewport.width) {
      left = viewport.width - pickerRect.width - 16;
    }

    // 确保不超出视口左边界
    if (left < 8) {
      left = 8;
    }

    // 确保不超出视口下边界
    if (top + pickerRect.height + 16 > viewport.height) {
      top = Math.max(8, viewport.height - pickerRect.height - 16);
    }

    setPosition({ top, left });
  };

  useEffect(() => {
    if (visible) {
      // 延迟计算位置，确保DOM已渲染
      const timer = setTimeout(calculatePosition, 0);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        visible &&
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  // ESC键关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && visible) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    onClose();
  };

  return (
    <EmojiPickerContainer
      ref={pickerRef}
      visible={visible}
      top={position.top}
      left={position.left}
    >
      <CloseButton onClick={onClose}>✕</CloseButton>
      
      {Object.entries(emojiCategories).map(([key, category]) => (
        <CategorySection key={key}>
          <CategoryTitle>
            <span>{category.label}</span>
            <span>{category.name}</span>
          </CategoryTitle>
          <EmojiGrid>
            {category.emojis.map((emoji) => (
              <EmojiButton
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                title={`发送 ${emoji}`}
              >
                {emoji}
              </EmojiButton>
            ))}
          </EmojiGrid>
        </CategorySection>
      ))}
    </EmojiPickerContainer>
  );
};

export default EmojiPicker;