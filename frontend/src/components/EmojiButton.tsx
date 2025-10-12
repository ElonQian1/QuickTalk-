import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/globalStyles';
import EmojiPicker from './EmojiPicker';

const EmojiButtonContainer = styled.button<{ $isActive?: boolean; disabled?: boolean }>`
  border: none;
  background: ${props => props.$isActive ? theme.colors.primary : 'transparent'};
  color: ${props => props.$isActive ? theme.colors.white : theme.colors.text.primary};
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius}px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  font-size: 20px;
  opacity: ${props => props.disabled ? 0.5 : 1};
  user-select: none;

  &:hover:not(:disabled) {
    background: ${props => props.$isActive ? theme.colors.primary : theme.colors.background};
    transform: translateY(-1px);
    opacity: 0.8;
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }
`;

interface EmojiButtonProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}

const EmojiButton: React.FC<EmojiButtonProps> = ({
  onEmojiSelect,
  disabled = false,
  className
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleButtonClick = () => {
    if (disabled) return;
    setShowPicker(!showPicker);
  };

  const handleEmojiSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setShowPicker(false);
  };

  const handleClose = () => {
    setShowPicker(false);
  };

  return (
    <>
      <EmojiButtonContainer
        ref={buttonRef}
        onClick={handleButtonClick}
        disabled={disabled}
        $isActive={showPicker}
        className={className}
        title="发送表情"
        type="button"
      >
        😄
      </EmojiButtonContainer>
      
      <EmojiPicker
        visible={showPicker}
        onEmojiSelect={handleEmojiSelect}
        onClose={handleClose}
        anchorRef={buttonRef}
      />
    </>
  );
};

export default EmojiButton;