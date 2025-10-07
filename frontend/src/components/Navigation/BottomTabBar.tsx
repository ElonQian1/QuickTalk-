import React from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiMessageCircle, FiUser, FiShoppingBag } from 'react-icons/fi';
import { theme } from '../../styles/globalStyles';
import { Badge } from '../../styles/globalStyles';

const TabBarContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${theme.colors.white};
  border-top: 1px solid ${theme.colors.border};
  padding: ${theme.spacing.sm} 0;
  padding-bottom: max(${theme.spacing.sm}, env(safe-area-inset-bottom));
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1050;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  pointer-events: auto; /* 确保可以接收点击事件 */
  
  @media (min-width: ${theme.breakpoints.tablet}) {
    display: none; /* 在平板和桌面端隐藏 */
  }
`;

const TabItem = styled.button<{ active?: boolean }>`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 50px;
  position: relative;
  transition: all 0.2s ease;
  touch-action: manipulation; /* 改善移动端触摸响应 */
  -webkit-tap-highlight-color: transparent; /* 移除移动端点击高亮 */
  
  &:active {
    transform: scale(0.95);
    background: ${theme.colors.background};
  }

  &:hover {
    background: ${theme.colors.background};
  }

  /* 确保可点击区域足够大 */
  min-height: 48px;
  flex: 1;
`;

const TabIcon = styled.div<{ active?: boolean }>`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  
  svg {
    width: 20px;
    height: 20px;
    color: ${props => props.active ? theme.colors.primary : theme.colors.text.secondary};
    transition: color 0.2s ease;
  }
`;

const TabLabel = styled.span<{ active?: boolean }>`
  font-size: ${theme.typography.caption};
  color: ${props => props.active ? theme.colors.primary : theme.colors.text.secondary};
  font-weight: ${props => props.active ? '600' : '400'};
  transition: color 0.2s ease;
`;

const NotificationBadge = styled(Badge)`
  position: absolute;
  top: -2px;
  right: -2px;
`;

interface TabItemType {
  key: string;
  label: string;
  icon: React.ComponentType;
  path: string;
  badge?: number;
}

interface BottomTabBarProps {
  unreadCount?: number;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ unreadCount = 0 }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs: TabItemType[] = [
    {
      key: 'home',
      label: '首页',
      icon: FiHome,
      path: '/home',
    },
    {
      key: 'messages',
      label: '消息',
      icon: FiMessageCircle,
      path: '/messages',
      badge: unreadCount,
    },
    {
      key: 'shops',
      label: '店铺',
      icon: FiShoppingBag,
      path: '/shops',
    },
    {
      key: 'profile',
      label: '我的',
      icon: FiUser,
      path: '/profile',
    },
  ];

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.startsWith('/home') || path === '/') return 'home';
    if (path.startsWith('/messages') || path.includes('/customers') || path.includes('/chat')) return 'messages';
    if (path.startsWith('/shops')) return 'shops';
    if (path.startsWith('/profile')) return 'profile';
    return 'home';
  };

  const activeTab = getCurrentTab();

  const handleTabPress = (tab: TabItemType, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    console.log(`导航至: ${tab.label} (${tab.path})`);
    navigate(tab.path);
  };

  return (
    <TabBarContainer>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        
        return (
          <TabItem
            key={tab.key}
            active={isActive}
            onClick={(event) => handleTabPress(tab, event)}
          >
            <TabIcon active={isActive}>
              <Icon />
              {tab.badge && tab.badge > 0 && (
                <NotificationBadge count={tab.badge} />
              )}
            </TabIcon>
            <TabLabel active={isActive}>{tab.label}</TabLabel>
          </TabItem>
        );
      })}
    </TabBarContainer>
  );
};

export default BottomTabBar;