import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { theme, Button } from '../../styles/globalStyles';
import { FiSettings, FiUsers, FiKey, FiInfo } from 'react-icons/fi';

// 未来可扩展：目前只是一个带下拉菜单的“管理”按钮。
// 设计思路：保持与全局 Button 风格一致；点击按钮展开浮层，提供店铺信息、员工管理、API Key 等入口。
// 暂不实现实际跳转逻辑，父组件可通过 onAction 回调统一处理。

export interface ShopBasicInfo {
  id: number;
  shop_name: string;
  shop_url?: string;
  api_key?: string;
}

interface ShopManageButtonProps {
  shop: ShopBasicInfo;
  onAction?: (action: 'info' | 'staff' | 'apiKey' | 'close', shop: ShopBasicInfo) => void;
  size?: 'small' | 'medium' | 'large';
  /**
   * 展示模式：
   * menu = 点击后展开下拉菜单（原行为）
   * direct = 直接触发 onAction('info')，用于页面只需打开管理模态框的场景
   */
  mode?: 'menu' | 'direct';
}

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const Dropdown = styled.div<{ open: boolean }>`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 180px;
  background: ${theme.colors.white};
  border-radius: ${theme.borderRadius.medium};
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  padding: 4px 0;
  z-index: 20;
  display: ${p => (p.open ? 'block' : 'none')};
`;

const MenuItem = styled.button`
  width: 100%;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.primary};
  cursor: pointer;
  text-align: left;
  transition: background .15s ease, color .15s ease;

  &:hover {
    background: ${theme.colors.background};
    color: ${theme.colors.primary};
  }

  svg { font-size: 16px; }
`;

const Divider = styled.div`
  height: 1px;
  background: ${theme.colors.divider};
  margin: 4px 0;
`;

const ShopManageButton: React.FC<ShopManageButtonProps> = ({ shop, onAction, size = 'small', mode = 'menu' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onAction?.('close', shop);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onAction, shop]);

  const trigger = () => {
    if (mode === 'direct') {
      onAction?.('info', shop);
      return;
    }
    setOpen(o => !o);
  };

  const handleSelect = (action: 'info' | 'staff' | 'apiKey') => {
    onAction?.(action, shop);
    setOpen(false);
  };

  return (
    <Wrapper ref={ref}>
      <Button
        size={size}
        variant="secondary"
        onClick={trigger}
        aria-haspopup={mode === 'menu' ? 'true' : undefined}
        aria-expanded={mode === 'menu' ? open : undefined}
      >
        <FiSettings style={{ marginRight: 4 }} /> 管理
      </Button>
      {mode === 'menu' && (
        <Dropdown open={open} role="menu">
          <MenuItem onClick={() => handleSelect('info')} role="menuitem">
            <FiInfo /> 店铺信息
          </MenuItem>
            <MenuItem onClick={() => handleSelect('staff')} role="menuitem">
              <FiUsers /> 员工管理
            </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleSelect('apiKey')} role="menuitem">
            <FiKey /> API Key
          </MenuItem>
        </Dropdown>
      )}
    </Wrapper>
  );
};

export default ShopManageButton;
