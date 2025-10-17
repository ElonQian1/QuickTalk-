/**
 * 通知权限请求 Banner 组件
 * 当通知权限为 default 状态时显示，引导用户授权
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FiBell, FiX } from 'react-icons/fi';
import { notificationService } from '../../services/notificationService';
import { useSettingsStore } from '../../stores/settingsStore';

const BannerContainer = styled.div<{ visible: boolean }>`
  position: fixed;
  top: ${props => props.visible ? '60px' : '-100px'};
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 600px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
  transition: top 0.3s ease;

  @media (max-width: 768px) {
    width: calc(100% - 32px);
    top: ${props => props.visible ? '16px' : '-100px'};
  }
`;

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 24px;
    height: 24px;
  }
`;

const Content = styled.div`
  flex: 1;
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
`;

const Description = styled.div`
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.4;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  flex-shrink: 0;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 8px;
  }
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  ${props => props.primary ? `
    background: white;
    color: #667eea;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  ` : `
    background: rgba(255, 255, 255, 0.2);
    color: white;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  `}

  &:active {
    transform: translateY(0);
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  padding: 4px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

interface NotificationPermissionBannerProps {
  /** 是否自动显示（当权限为 default 时） */
  autoShow?: boolean;
  /** 关闭后多久再次显示（毫秒），0 表示不再显示 */
  remindAfter?: number;
}

const STORAGE_KEY = 'notification-permission-dismissed-at';

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  autoShow = true,
  remindAfter = 24 * 60 * 60 * 1000, // 24小时
}) => {
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const notificationsEnabled = useSettingsStore((state) => state.notifications);

  useEffect(() => {
    checkPermissionAndVisibility();
  }, [autoShow, notificationsEnabled]);

  const checkPermissionAndVisibility = () => {
    // 检查通知服务是否支持
    const capabilities = notificationService.getCapabilities();
    if (!capabilities.notification) {
      setVisible(false);
      return;
    }

    // 检查当前权限
    const currentPermission = notificationService.getNotificationPermission();
    setPermission(currentPermission);

    // 只在权限为 default 且用户启用了通知设置时显示
    if (currentPermission !== 'default' || !notificationsEnabled) {
      setVisible(false);
      return;
    }

    // 检查是否被用户手动关闭过
    if (!autoShow) {
      setVisible(false);
      return;
    }

    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const now = Date.now();
      
      // 如果设置了提醒间隔，且未到提醒时间
      if (remindAfter > 0 && now - dismissedTime < remindAfter) {
        setVisible(false);
        return;
      }
    }

    setVisible(true);
  };

  const handleRequestPermission = async () => {
    const result = await notificationService.requestNotificationPermission();
    setPermission(result);
    
    if (result === 'granted') {
      setVisible(false);
      // 播放成功提示音
      notificationService.playSound(0.5).catch(() => {});
    } else if (result === 'denied') {
      setVisible(false);
      // 记录拒绝时间，避免频繁打扰
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    // 记录关闭时间
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  if (!visible) {
    return null;
  }

  return (
    <BannerContainer visible={visible}>
      <IconWrapper>
        <FiBell />
      </IconWrapper>
      <Content>
        <Title>开启消息通知</Title>
        <Description>
          允许通知权限，及时接收客户消息提醒
        </Description>
      </Content>
      <Actions>
        <Button primary onClick={handleRequestPermission}>
          允许通知
        </Button>
        <Button onClick={handleDismiss}>
          稍后再说
        </Button>
      </Actions>
      <CloseButton onClick={handleDismiss}>
        <FiX />
      </CloseButton>
    </BannerContainer>
  );
};

export default NotificationPermissionBanner;
