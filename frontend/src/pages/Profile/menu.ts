import { NavigateFunction } from 'react-router-dom';

export interface MenuItemDef {
  icon: string;
  text: string;
  color: string;
  onClick: () => void;
}

export const buildMenuItems = (
  navigate: NavigateFunction,
  openPersonalInfo: () => void,
  openSettings: () => void,
  openHelp: () => void,
): MenuItemDef[] => [
  {
    icon: '👤',
    text: '个人信息',
    color: '#007bff',
    onClick: openPersonalInfo,
  },
  {
    icon: '⚙️',
    text: '应用设置',
    color: '#6f42c1',
    onClick: openSettings,
  },
  {
    icon: '�',
    text: '数据统计',
    color: '#17a2b8',
    onClick: () => navigate('/statistics'),
  },
  {
    icon: '❓',
    text: '帮助中心',
    color: '#fd7e14',
    onClick: openHelp,
  },
];
