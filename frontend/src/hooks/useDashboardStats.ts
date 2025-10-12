import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../config/api';
import toast from 'react-hot-toast';
import { 
  DashboardStats, 
  ApiStatsResponse, 
  StatsHookOptions, 
  StatsHookReturn 
} from '../utils/statsTypes';
import { validateStatValue } from '../utils/statsUtils';

export const useDashboardStats = (
  options: StatsHookOptions = {}
): StatsHookReturn => {
  const {
    autoRefreshInterval = 30000, // 默认30秒
    enableAutoRefresh = true
  } = options;

  const [stats, setStats] = useState<DashboardStats>({
    totalMessages: 0,
    activeCustomers: 0,
    totalShops: 0,
    pendingChats: 0,
    todayMessages: 0,
    weekMessages: 0,
    monthMessages: 0,
    todayCustomers: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        if (isLoading) {
          // 首次加载，不显示刷新状态
        } else {
          setIsRefreshing(true);
        }
      }
      
      setError(null);
      
      const resp = await api.get('/api/dashboard/stats');
      const data = resp.data as ApiStatsResponse;
      
      // 映射后端字段到前端，使用验证函数确保数据有效性
      setStats({
        totalMessages: validateStatValue(data.unread_messages),
        activeCustomers: validateStatValue(data.active_customers),
        totalShops: validateStatValue(data.total_shops),
        pendingChats: validateStatValue(data.pending_chats),
        todayMessages: validateStatValue(data.today_messages),
        weekMessages: validateStatValue(data.week_messages),
        monthMessages: validateStatValue(data.month_messages),
        todayCustomers: validateStatValue(data.today_customers),
      });
      
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('获取统计数据失败:', err);
      const errorMsg = '获取统计数据失败，请稍后重试';
      setError(errorMsg);
      
      if (!silent) {
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isLoading]);

  const refreshStats = useCallback(async () => {
    await fetchStats(false);
  }, [fetchStats]);

  // 启动自动刷新
  useEffect(() => {
    if (enableAutoRefresh && autoRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchStats(true); // 静默刷新
      }, autoRefreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableAutoRefresh, autoRefreshInterval, fetchStats]);

  // 初始加载
  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    stats,
    isLoading,
    isRefreshing,
    error,
    refreshStats,
    lastUpdated,
  };
};