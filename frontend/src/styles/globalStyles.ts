import styled, { createGlobalStyle } from 'styled-components';
import { spacing as scaleSpacing, typography as scaleTypography } from './scale';

// 主题配置
export const theme = {
  colors: {
    primary: '#07C160',      // 微信绿
    secondary: '#576b95',    // 微信蓝
    background: '#F5F5F5',   // 背景灰
    white: '#FFFFFF',
    black: '#000000',
    text: {
      primary: '#1A1A1A',
      secondary: '#666666',
      placeholder: '#999999',
    },
    border: '#E5E5E5',
    divider: '#EFEFEF',
    danger: '#FA5151',
    warning: '#FFC300',
    success: '#07C160',
    online: '#07C160',
    offline: '#CCCCCC',
  },
  shadows: {
    card: '0 1px 3px rgba(0, 0, 0, 0.12)',
    modal: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '50%',
  },
  spacing: scaleSpacing,
  typography: scaleTypography,
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1200px',
  },
};

// 全局样式
export const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    /*
      自适应字体策略：
      以 iPhone 14 Pro Max (逻辑宽度 ~430px) 的视觉为基准。
      当屏幕宽度 < 430px 时按比例缩小 root 字号，组件 rem 计算随之缩放；
      大于 430px 时不无限放大，限制一个上限，保持统一视觉密度。
    */
    --design-base-width: 430; /* 基准宽度，可根据喜欢的参考机型调整 */
    --min-font: 14; /* 最小根字号 */
    --max-font: 16; /* 基准/最大根字号 */
    /* 公式：16 * (当前宽度 / 430)，再夹在最小与最大之间 */
    font-size: clamp(var(--min-font)px, calc((100vw / var(--design-base-width)) * var(--max-font) * 1px), var(--max-font)px);
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: ${theme.colors.background};
    color: ${theme.colors.text.primary};
  font-size: 1rem; /* 使用 root 缩放 */
    line-height: 1.5;
    min-height: 100dvh;
    min-height: -webkit-fill-available;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-text-size-adjust: 100%;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  #root {
    min-height: 100dvh;
    min-height: -webkit-fill-available;
    display: flex;
    flex-direction: column;
  }

  /* 可选：用于在不同手机上保持主内容宽度近似 430px，居中显示 */
  .app-fixed-width {
    width: 100%;
    max-width: 430px; /* 与设计基准宽度一致 */
    margin: 0 auto;
  }

  /* 滚动条样式 */
  ::-webkit-scrollbar {
    width: 4px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.border};
    border-radius: 2px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.text.placeholder};
  }

  /* 移动端适配 */
  /* 通过 root clamp 已处理缩放，这里不再强制覆盖 html/body 字号 */

  /* 输入框通用样式 */
  input, textarea {
    font-family: inherit;
    font-size: inherit;
    border: none;
    outline: none;
    
    &::placeholder {
      color: ${theme.colors.text.placeholder};
    }
  }

  /* 按钮通用样式 */
  button {
    font-family: inherit;
    font-size: inherit;
    border: none;
    outline: none;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  /* 链接样式 */
  a {
    color: inherit;
    text-decoration: none;
  }

  /* 列表样式 */
  ul, ol {
    list-style: none;
  }

  /* 图片样式 */
  img {
    max-width: 100%;
    height: auto;
  }

  /* 通用动画 */
  .fade-in {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .slide-up {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

// 通用组件样式
export const Container = styled.div`
  max-width: 100%;
  margin: 0 auto;
  padding: 0 ${theme.spacing.md};
  height: 100%;
`;

export const Card = styled.div`
  background: ${theme.colors.white};
  border-radius: ${theme.borderRadius.medium};
  box-shadow: ${theme.shadows.card};
  overflow: hidden;
`;

export const Button = styled.button<{
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.borderRadius.small};
  font-weight: 500;
  transition: all 0.2s ease;
  
  ${props => {
    switch (props.size) {
      case 'small':
        return `
          height: 2rem; /* 32px 基准 */
          padding: 0 1rem; /* 16px */
          font-size: 0.875rem; /* 14px */
        `;
      case 'large':
        return `
          height: 3rem; /* 48px */
          padding: 0 1.5rem; /* 24px */
          font-size: 1rem; /* 16px */
        `;
      default:
        return `
          height: 2.5rem; /* 40px */
          padding: 0 1rem; /* 16px */
          font-size: 1rem; /* 16px */
        `;
    }
  }}
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: ${theme.colors.primary};
          color: ${theme.colors.white};
          
          &:hover:not(:disabled) {
            background: #06A94D;
          }
          
          &:active {
            background: #059246;
          }
        `;
      case 'secondary':
        return `
          background: ${theme.colors.white};
          color: ${theme.colors.text.primary};
          border: 1px solid ${theme.colors.border};
          
          &:hover:not(:disabled) {
            border-color: ${theme.colors.primary};
            color: ${theme.colors.primary};
          }
        `;
      case 'text':
        return `
          background: transparent;
          color: ${theme.colors.primary};
          
          &:hover:not(:disabled) {
            background: rgba(7, 193, 96, 0.1);
          }
        `;
      default:
        return `
          background: ${theme.colors.primary};
          color: ${theme.colors.white};
        `;
    }
  }}
  
  ${props => props.fullWidth && `width: 100%;`}
`;

export const Input = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 ${theme.spacing.md};
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.small};
  font-size: ${theme.typography.body};
  transition: border-color 0.2s ease;
  
  &:focus {
    border-color: ${theme.colors.primary};
  }
  
  &::placeholder {
    color: ${theme.colors.text.placeholder};
  }
`;

export const Avatar = styled.div<{ size?: number; src?: string }>`
  width: ${props => props.size || 40}px;
  height: ${props => props.size || 40}px;
  border-radius: ${theme.borderRadius.round};
  background: ${props => props.src ? `url(${props.src})` : theme.colors.border};
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${props => (props.size || 40) * 0.4}px;
  color: ${theme.colors.text.secondary};
  font-weight: 500;
  flex-shrink: 0;
`;

export const Badge = styled.span<{ count?: number; dot?: boolean }>`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  background: ${theme.colors.danger};
  color: ${theme.colors.white};
  border-radius: 9px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${props => props.dot && `
    width: 8px;
    height: 8px;
    min-width: auto;
    padding: 0;
    border-radius: 50%;
  `}
  
  ${props => props.count === 0 && `display: none;`}
`;

export const Divider = styled.div`
  height: 1px;
  background: ${theme.colors.divider};
  margin: ${theme.spacing.md} 0;
`;

export const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid ${theme.colors.border};
  border-top: 2px solid ${theme.colors.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;