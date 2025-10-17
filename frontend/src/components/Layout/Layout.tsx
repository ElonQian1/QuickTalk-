import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMoreHorizontal } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { theme } from '../../styles/globalStyles';
import { BottomTabBar } from '../Navigation';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: ${theme.colors.background};
`;

const Header = styled.header`
  background: ${theme.colors.white};
  border-bottom: 1px solid ${theme.colors.border};
  height: 3.5rem; /* 56px */
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
  width: 2.5rem;
  height: 2.5rem;
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
  width: 1.25rem;
  height: 1.25rem;
    color: ${theme.colors.text.primary};
  }
`;

const MenuWrapper = styled.div`
  position: relative;
`;

const Dropdown = styled.div`
  position: absolute;
  top: 2.75rem;
  right: 0;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.medium};
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  min-width: 140px;
  padding: 4px;
  z-index: 20;
`;

const DropdownItem = styled.button`
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  color: ${theme.colors.text.primary};
  border-radius: ${theme.borderRadius.small};
  font-size: ${theme.typography.body};

  &:hover {
    background: ${theme.colors.background};
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    
    if (path === '/statistics') {
      return { title: '数据统计', showBack: true, showBottomNav: false };
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
    setMenuOpen((v) => !v);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  // 监听来自通知点击的“打开会话”事件
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { shopId?: number; sessionId?: number } | undefined;
        if (detail?.sessionId) {
          navigate(`/chat/${detail.sessionId}`);
        }
      } catch {}
    };
    window.addEventListener('open-session', handler as EventListener);
    return () => window.removeEventListener('open-session', handler as EventListener);
  }, [navigate]);

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
          <MenuWrapper ref={menuRef}>
            <IconButton onClick={handleMenuClick} aria-haspopup="menu" aria-expanded={menuOpen}>
              <FiMoreHorizontal />
            </IconButton>
            {menuOpen && (
              <Dropdown role="menu">
                <DropdownItem onClick={() => { setMenuOpen(false); navigate('/profile'); }}>个人中心</DropdownItem>
                <DropdownItem onClick={() => { setMenuOpen(false); navigate('/statistics'); }}>数据统计</DropdownItem>
                <DropdownItem onClick={() => {
                  setMenuOpen(false);
                  if (window.confirm('确定要退出登录吗？')) {
                    logout();
                  }
                }}>退出登录</DropdownItem>
              </Dropdown>
            )}
          </MenuWrapper>
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