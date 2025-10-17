import React, { useState } from 'react';
import styled from 'styled-components';
import { FiChevronLeft } from 'react-icons/fi';
import { useSettingsStore } from '../../../stores/settingsStore';
import { notificationService } from '../../../services/notificationService';
import toast from 'react-hot-toast';

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8f9fa;
  z-index: 1100;
  overflow-y: auto;
`;

const Header = styled.div`
  background: white;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  margin-right: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: #f8f9fa;
  }

  svg {
    width: 20px;
    height: 20px;
    color: #333;
  }
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const Content = styled.div`
  padding-bottom: 80px; /* 为底部导航留出空间 */
`;

const Section = styled.div`
  background: white;
  margin: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const SectionTitle = styled.div`
  padding: 16px 20px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SettingItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:last-child {
    border-bottom: none;
  }
`;

const SettingLeft = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
`;

const SettingIcon = styled.div<{ color: string }>`
  width: 32px;
  height: 32px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.color || '#6c757d'};
  border-radius: 8px;
  color: white;
  font-size: 16px;
`;

const SettingContent = styled.div`
  flex: 1;
`;

const SettingTitle = styled.div`
  font-size: 16px;
  color: #333;
  margin-bottom: 4px;
`;

const SettingDescription = styled.div`
  font-size: 12px;
  color: #666;
`;

const Switch = styled.div<{ active: boolean }>`
  width: 44px;
  height: 24px;
  background: ${props => props.active ? '#00d4aa' : '#ccc'};
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;

  &::after {
    content: '';
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: ${props => props.active ? '22px' : '2px'};
    transition: left 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
`;

const SelectValue = styled.div`
  color: #666;
  font-size: 14px;
  margin-right: 8px;
`;

const Arrow = styled.div`
  color: #999;
  font-size: 14px;
`;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // 从 settingsStore 获取设置
  const notifications = useSettingsStore((state) => state.notifications);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const vibrationEnabled = useSettingsStore((state) => state.vibrationEnabled);
  const autoReply = useSettingsStore((state) => state.autoReply);
  const darkMode = useSettingsStore((state) => state.darkMode);
  
  // 获取设置操作方法
  const toggleNotifications = useSettingsStore((state) => state.toggleNotifications);
  const toggleSound = useSettingsStore((state) => state.toggleSound);
  const toggleVibration = useSettingsStore((state) => state.toggleVibration);
  const toggleAutoReply = useSettingsStore((state) => state.toggleAutoReply);
  const toggleDarkMode = useSettingsStore((state) => state.toggleDarkMode);

  if (!isOpen) return null;

  // 处理通知开关切换
  const handleNotificationsToggle = async () => {
    const newValue = !notifications;
    toggleNotifications();
    
    // 如果要开启通知，检查浏览器权限
    if (newValue) {
      const permission = notificationService.getNotificationPermission();
      if (permission === 'default') {
        const result = await notificationService.requestNotificationPermission();
        if (result === 'denied') {
          toast.error('通知权限被拒绝，请在浏览器设置中允许通知');
        } else if (result === 'granted') {
          toast.success('通知权限已授予');
        }
      }
    }
  };

  // 处理声音开关切换
  const handleSoundToggle = async () => {
    const newValue = !soundEnabled;
    toggleSound();
    
    // 如果开启声音，播放测试音
    if (newValue) {
      try {
        await notificationService.playSound(0.5);
        toast.success('提示音已启用');
      } catch (error) {
        toast('提示音播放失败，可能需要用户交互后才能播放', { icon: '⚠️' });
      }
    }
  };

  // 处理震动开关切换
  const handleVibrationToggle = () => {
    const newValue = !vibrationEnabled;
    toggleVibration();
    
    // 如果开启震动，测试震动
    if (newValue) {
      const success = notificationService.vibrate([200]);
      if (success) {
        toast.success('振动已启用');
      } else {
        toast('当前设备不支持振动功能', { icon: 'ℹ️' });
      }
    }
  };

  const notificationSettings = [
    {
      key: 'notifications',
      icon: '🔔',
      color: '#ffc107',
      title: '推送通知',
      description: '接收新消息通知',
      value: notifications,
      onChange: handleNotificationsToggle,
    },
    {
      key: 'soundEnabled',
      icon: '🔊',
      color: '#17a2b8',
      title: '消息提示音',
      description: '新消息时播放提示音',
      value: soundEnabled,
      onChange: handleSoundToggle,
    },
    {
      key: 'vibrationEnabled',
      icon: '📳',
      color: '#6f42c1',
      title: '振动提醒',
      description: '新消息时设备振动',
      value: vibrationEnabled,
      onChange: handleVibrationToggle,
    }
  ];

  const chatSettings = [
    {
      key: 'autoReply',
      icon: '🤖',
      color: '#28a745',
      title: '自动回复',
      description: '离线时自动回复客户消息',
      value: autoReply,
      onChange: toggleAutoReply,
    }
  ];

  const displaySettings = [
    {
      key: 'darkMode',
      icon: '🌙',
      color: '#495057',
      title: '深色模式',
      description: '使用深色主题',
      value: darkMode,
      onChange: toggleDarkMode,
    }
  ];

  const otherSettings = [
    {
      icon: '🌐',
      color: '#007bff',
      title: '语言设置',
      description: '选择界面语言',
      type: 'select',
      value: '中文简体',
      onClick: () => {} // 语言设置功能待实现
    },
    {
      icon: '📝',
      color: '#fd7e14',
      title: '字体大小',
      description: '调整字体显示大小',
      type: 'select',
      value: '中等',
      onClick: () => {} // 字体大小功能待实现
    },
    {
      icon: '💾',
      color: '#20c997',
      title: '数据管理',
      description: '清理缓存和数据',
      type: 'action',
      onClick: () => {} // 数据管理功能待实现
    },
    {
      icon: '🔄',
      color: '#6610f2',
      title: '检查更新',
      description: '检查应用更新',
      type: 'action',
      onClick: () => {} // 检查更新功能待实现
    }
  ];

  const renderSwitchItem = (item: {
    key: string;
    icon: string;
    color: string;
    title: string;
    description: string;
    value: boolean;
    onChange: () => void;
  }) => (
    <SettingItem key={item.key}>
      <SettingLeft>
        <SettingIcon color={item.color}>
          {item.icon}
        </SettingIcon>
        <SettingContent>
          <SettingTitle>{item.title}</SettingTitle>
          <SettingDescription>{item.description}</SettingDescription>
        </SettingContent>
      </SettingLeft>
      <Switch 
        active={item.value}
        onClick={item.onChange}
      />
    </SettingItem>
  );

  const renderActionItem = (item: any, index: number) => (
    <SettingItem key={index} onClick={item.onClick} style={{ cursor: 'pointer' }}>
      <SettingLeft>
        <SettingIcon color={item.color}>
          {item.icon}
        </SettingIcon>
        <SettingContent>
          <SettingTitle>{item.title}</SettingTitle>
          <SettingDescription>{item.description}</SettingDescription>
        </SettingContent>
      </SettingLeft>
      {item.type === 'select' && (
        <>
          <SelectValue>{item.value}</SelectValue>
          <Arrow>›</Arrow>
        </>
      )}
      {item.type === 'action' && <Arrow>›</Arrow>}
    </SettingItem>
  );

  return (
    <Container>
      <Header>
        <BackButton onClick={onClose}>
          <FiChevronLeft />
        </BackButton>
        <HeaderTitle>设置</HeaderTitle>
      </Header>

      <Content>
        <Section>
          <SectionTitle>通知设置</SectionTitle>
          {notificationSettings.map(renderSwitchItem)}
        </Section>

        <Section>
          <SectionTitle>聊天设置</SectionTitle>
          {chatSettings.map(renderSwitchItem)}
        </Section>

        <Section>
          <SectionTitle>显示设置</SectionTitle>
          {displaySettings.map(renderSwitchItem)}
        </Section>

        <Section>
          <SectionTitle>其他设置</SectionTitle>
          {otherSettings.map((item, index) => renderActionItem(item, index))}
        </Section>
      </Content>
    </Container>
  );
};

export default SettingsModal;