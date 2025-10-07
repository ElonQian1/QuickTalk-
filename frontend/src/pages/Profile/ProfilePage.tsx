import React, { useState } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../stores/authStore';
import { SettingsModal } from './components';

const Container = styled.div`
  min-height: 100vh;
  background: ${props => props.theme.colors.background};
  padding-bottom: 80px; /* 为底部导航留出空间 */
`;

const Header = styled.div`
  background: linear-gradient(135deg, #00d4aa, #00b4d8);
  padding: 40px 20px 20px;
  text-align: center;
  color: white;
`;

const Avatar = styled.div`
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  border: 3px solid rgba(255, 255, 255, 0.3);
`;

const UserName = styled.h2`
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
`;

const UserRole = styled.p`
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
`;

const MenuSection = styled.div`
  background: white;
  margin: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const MenuItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f8f9fa;
  }
`;

const MenuItemLeft = styled.div`
  display: flex;
  align-items: center;
`;

const MenuIcon = styled.div`
  width: 24px;
  height: 24px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.color || '#6c757d'};
  border-radius: 6px;
  color: white;
  font-size: 12px;
`;

const MenuText = styled.span`
  font-size: 16px;
  color: #333;
`;

const MenuArrow = styled.div`
  color: #999;
  font-size: 14px;
`;

const StatsSection = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: #e9ecef;
  margin: 12px 16px;
  border-radius: 12px;
  overflow: hidden;
`;

const StatItem = styled.div`
  background: white;
  padding: 20px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #00d4aa;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #666;
`;

const LogoutButton = styled.button`
  width: calc(100% - 32px);
  margin: 20px 16px;
  padding: 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #c82333;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const menuItems = [
    {
      icon: '👤',
      text: '账户设置',
      color: '#007bff',
      onClick: () => console.log('账户设置')
    },
    {
      icon: '🏪',
      text: '我的店铺',
      color: '#28a745',
      onClick: () => console.log('我的店铺')
    },
    {
      icon: '⚙️',
      text: '应用设置',
      color: '#6f42c1',
      onClick: handleSettingsClick
    },
    {
      icon: '�',
      text: '数据统计',
      color: '#17a2b8',
      onClick: () => console.log('数据统计')
    },
    {
      icon: '�',
      text: '联系客服',
      color: '#ffc107',
      onClick: () => console.log('联系客服')
    },
    {
      icon: '❓',
      text: '帮助中心',
      color: '#fd7e14',
      onClick: () => console.log('帮助中心')
    }
  ];

  return (
    <Container>
      <Header>
        <Avatar>
          {user?.username?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <UserName>{user?.username || '用户'}</UserName>
        <UserRole>客服管理员</UserRole>
      </Header>

      <StatsSection>
        <StatItem>
          <StatValue>158</StatValue>
          <StatLabel>今日消息</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>89</StatValue>
          <StatLabel>活跃客户</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>12</StatValue>
          <StatLabel>待处理</StatLabel>
        </StatItem>
      </StatsSection>

      <MenuSection>
        {menuItems.map((item, index) => (
          <MenuItem key={index} onClick={item.onClick}>
            <MenuItemLeft>
              <MenuIcon color={item.color}>
                {item.icon}
              </MenuIcon>
              <MenuText>{item.text}</MenuText>
            </MenuItemLeft>
            <MenuArrow>›</MenuArrow>
          </MenuItem>
        ))}
      </MenuSection>

      <LogoutButton onClick={handleLogout}>
        退出登录
      </LogoutButton>

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </Container>
  );
};

export default ProfilePage;