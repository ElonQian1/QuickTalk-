/**
 * 统计数据相关的类型定义
 */
import { IconType } from 'react-icons';

// 基础统计数据
export interface DashboardStats {
  totalMessages: number;
  activeCustomers: number;
  totalShops: number;
  pendingChats: number;
  todayMessages: number;
  weekMessages: number;
  monthMessages: number;
  todayCustomers: number;
}

// API响应统计数据
export interface ApiStatsResponse {
  total_shops: number;
  active_customers: number;
  unread_messages: number;
  pending_chats: number;
  today_messages: number;
  week_messages: number;
  month_messages: number;
  today_customers: number;
}

// 统计卡片数据
export interface StatCardData {
  icon: IconType;
  value: number;
  label: string;
  color: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
}

// 统计趋势数据
export interface StatTrend {
  current: number;
  previous: number;
  percentage: number;
  trend: 'up' | 'down' | 'neutral';
}

// 时间段统计
export interface PeriodStats {
  today: number;
  week: number;
  month: number;
}

// 统计Hook配置
export interface StatsHookOptions {
  autoRefreshInterval?: number;
  enableAutoRefresh?: boolean;
  enableTrends?: boolean;
}

// 统计Hook返回值
export interface StatsHookReturn {
  stats: DashboardStats;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  lastUpdated: Date | null;
  trends?: Record<string, StatTrend>;
}