import React, { useState } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../stores/authStore';
import { SettingsModal, HelpModal, PersonalInfoModal } from './components';
import { useNavigate } from 'react-router-dom';
import { buildMenuItems } from './menu';

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
  const [showPersonal, setShowPersonal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  const handleSettingsClick = () => setShowSettings(true);
  const handlePersonalClick = () => setShowPersonal(true);
  const handleHelpClick = () => setShowHelp(true);

  const menuItems = buildMenuItems(
    navigate,
    handlePersonalClick,
    handleSettingsClick,
    handleHelpClick,
  );

  return (
    <Container>
      <Header>
        <Avatar>
          {user?.username?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <UserName>{user?.username || '用户'}</UserName>
      </Header>

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
      <PersonalInfoModal 
        isOpen={showPersonal}
        onClose={() => setShowPersonal(false)}
      />
      <HelpModal 
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </Container>
  );
};

export default ProfilePage;