import React from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMoreHorizontal } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { theme } from '../../styles/globalStyles';
import { BottomTabBar } from '../Navigation';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${theme.colors.background};
`;

const Header = styled.header`
  background: ${theme.colors.white};
  border-bottom: 1px solid ${theme.colors.border};
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${theme.spacing.md};
  position: relative;
  z-index: 10;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`;

const HeaderTitle = styled.h1`
  font-size: ${theme.typography.h3};
  font-weight: 600;
  color: ${theme.colors.text.primary};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.round};
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: ${theme.colors.background};
  }
  
  svg {
    width: 20px;
    height: 20px;
    color: ${theme.colors.text.primary};
  }
`;

const Content = styled.main`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  // 根据路由确定页面标题和是否显示返回按钮
  const getPageInfo = () => {
    const path = location.pathname;
    
    if (path === '/home' || path === '/') {
      return { title: '客服后台', showBack: false, showBottomNav: true };
    }
    
    if (path === '/shops') {
      return { title: '店铺管理', showBack: false, showBottomNav: true };
    }
    
    if (path === '/messages') {
      return { title: '消息中心', showBack: false, showBottomNav: true };
    }
    
    if (path === '/profile') {
      return { title: '个人中心', showBack: false, showBottomNav: true };
    }
    
    if (path.includes('/customers')) {
      return { title: '客户列表', showBack: true, showBottomNav: false };
    }
    
    if (path.includes('/chat/')) {
      return { title: '客服聊天', showBack: true, showBottomNav: false };
    }
    
    return { title: '客服后台', showBack: false, showBottomNav: true };
  };

  const { title, showBack, showBottomNav } = getPageInfo();

  const handleBack = () => {
    navigate(-1);
  };

  const handleMenuClick = () => {
    // 这里可以显示菜单，包括退出登录等选项
    if (window.confirm('确定要退出登录吗？')) {
      logout();
    }
  };

  return (
    <LayoutContainer>
      <Header>
        <HeaderLeft>
          {showBack && (
            <IconButton onClick={handleBack}>
              <FiArrowLeft />
            </IconButton>
          )}
          <HeaderTitle>{title}</HeaderTitle>
        </HeaderLeft>
        
        <HeaderRight>
          <IconButton onClick={handleMenuClick}>
            <FiMoreHorizontal />
          </IconButton>
        </HeaderRight>
      </Header>
      
      <Content>
        {children}
      </Content>
      
      {showBottomNav && <BottomTabBar />}
    </LayoutContainer>
  );
};

export default Layout;