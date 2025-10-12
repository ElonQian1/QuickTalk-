import React from 'react';
import styled from 'styled-components';
import { FiCalendar } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../styles/globalStyles';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { PeriodStats, TrendAnalysis, DataSummary, RefreshStatsButton } from '../../components/Statistics';
import { Section, SectionTitle } from '../../components/UI';

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
`;

const ScrollableContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.xxl};
  
  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
`;


const StatisticsPage: React.FC = () => {
  const { stats, isLoading, isRefreshing, refreshStats, lastUpdated } = useDashboardStats({
    autoRefreshInterval: 60000, // 1分钟刷新
    enableAutoRefresh: true
  });

  // 时间段统计数据 (保持原有PeriodStats组件)
  const periodData = [
    {
      period: 'today',
      label: '今日',
      metrics: [
        { label: '消息数量', value: stats.todayMessages },
        { label: '活跃客户', value: stats.todayCustomers }
      ]
    },
    {
      period: 'week',
      label: '本周',
      metrics: [
        { label: '消息数量', value: stats.weekMessages },
        { label: '平均日消息', value: Math.round(stats.weekMessages / 7) }
      ]
    },
    {
      period: 'month',
      label: '本月',
      metrics: [
        { label: '消息数量', value: stats.monthMessages },
        { label: '平均周消息', value: Math.round(stats.monthMessages / 4) }
      ]
    }
  ];

  return (
    <Container>
  {/* 顶部更新时间吸附条已移除 */}

      <ScrollableContent>
        {/* 数据总结与建议 */}
        <DataSummary
          todayMessages={stats.todayMessages}
          weekMessages={stats.weekMessages}
          monthMessages={stats.monthMessages}
          activeCustomers={stats.activeCustomers}
          pendingChats={stats.pendingChats}
          totalShops={stats.totalShops}
        />

        {/** 已按需移除“数据统计”这一栏（原 DataInsights） */}

        {/* 趋势分析 */}
        <TrendAnalysis
          todayMessages={stats.todayMessages}
          weekMessages={stats.weekMessages}
          monthMessages={stats.monthMessages}
          todayCustomers={stats.todayCustomers}
          activeCustomers={stats.activeCustomers}
        />

        {/* 时间段详细统计 */}
        <Section>
          <SectionTitle>
            <FiCalendar />
            时间段详细数据
          </SectionTitle>
          <PeriodStats 
            periods={periodData}
            isLoading={isLoading}
          />
        </Section>

        {/* 操作区域 */}
        <Section>
          <RefreshStatsButton
            onRefresh={refreshStats}
            isRefreshing={isRefreshing}
          />
        </Section>
      </ScrollableContent>
    </Container>
  );
};

export default StatisticsPage;