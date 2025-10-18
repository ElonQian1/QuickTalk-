/**
 * 新架构测试页面
 * 用于验证V2 Store和适配器是否正常工作
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { featureFlags } from '../stores/config/featureFlags';
import { cacheManager } from '../stores/v2';
import { useShopsData, useCreateShop } from '../hooks/useShopsAdapter';
import { useCustomersData } from '../hooks/useCustomersAdapter';
import { useMessagesData } from '../hooks/useMessagesAdapter';
import { theme } from '../styles/globalStyles';

const Container = styled.div`
  padding: ${theme.spacing.lg};
  max-width: 1200px;
  margin: 0 auto;
`;

const Section = styled.div`
  margin-bottom: ${theme.spacing.xl};
  padding: ${theme.spacing.md};
  background: ${theme.colors.white};
  border-radius: ${theme.borderRadius.medium};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SectionTitle = styled.h2`
  font-size: ${theme.typography.h3};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.md};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.md};
`;

const FlagCard = styled.div<{ $enabled: boolean }>`
  padding: ${theme.spacing.sm};
  background: ${p => p.$enabled ? theme.colors.success + '20' : theme.colors.border};
  border: 2px solid ${p => p.$enabled ? theme.colors.success : '#ccc'};
  border-radius: ${theme.borderRadius.small};
`;

const FlagName = styled.div`
  font-weight: 600;
  font-size: ${theme.typography.small};
  margin-bottom: 4px;
`;

const FlagStatus = styled.div<{ $enabled: boolean }>`
  font-size: ${theme.typography.caption};
  color: ${p => p.$enabled ? theme.colors.success : theme.colors.text.secondary};
`;

const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.primary};
  color: ${theme.colors.white};
  border: none;
  border-radius: ${theme.borderRadius.small};
  cursor: pointer;
  font-size: ${theme.typography.body};
  margin-right: ${theme.spacing.sm};
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const DataCard = styled.div`
  padding: ${theme.spacing.sm};
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.small};
  margin-bottom: ${theme.spacing.sm};
`;

const Code = styled.pre`
  background: #f5f5f5;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.small};
  overflow-x: auto;
  font-size: ${theme.typography.small};
`;

export const ArchitectureTestPage: React.FC = () => {
  const [testShopId, setTestShopId] = useState<number | null>(null);
  const [testSessionId, setTestSessionId] = useState<number | null>(null);

  // 测试适配器
  const { shops, loading: shopsLoading, reload: reloadShops } = useShopsData();
  const { createShop, creating } = useCreateShop();
  const { customers, loading: customersLoading, reload: reloadCustomers } = useCustomersData(testShopId);
  const { messages, loading: messagesLoading, sendMessage } = useMessagesData(testSessionId);

  const handleTestCreateShop = async () => {
    try {
      const newShop = await createShop({
        name: `测试店铺 ${Date.now()}`,
        slug: `test-${Date.now()}`
      });
      console.log('✅ 创建成功:', newShop);
      reloadShops();
    } catch (err) {
      console.error('❌ 创建失败:', err);
    }
  };

  const handleTestSendMessage = async () => {
    if (!testSessionId) {
      alert('请先设置测试会话ID');
      return;
    }
    try {
      await sendMessage('测试消息: ' + new Date().toLocaleTimeString(), 'test-user');
      console.log('✅ 发送成功');
    } catch (err) {
      console.error('❌ 发送失败:', err);
    }
  };

  return (
    <Container>
      <h1>🧪 新架构测试页面</h1>
      
      {/* Feature Flags 状态 */}
      <Section>
        <SectionTitle>🚩 Feature Flags 状态</SectionTitle>
        <Grid>
          <FlagCard $enabled={featureFlags.USE_NEW_CACHE}>
            <FlagName>缓存系统</FlagName>
            <FlagStatus $enabled={featureFlags.USE_NEW_CACHE}>
              {featureFlags.USE_NEW_CACHE ? '✅ 启用' : '❌ 禁用'}
            </FlagStatus>
          </FlagCard>
          
          <FlagCard $enabled={featureFlags.USE_NEW_SHOPS_STORE}>
            <FlagName>店铺Store V2</FlagName>
            <FlagStatus $enabled={featureFlags.USE_NEW_SHOPS_STORE}>
              {featureFlags.USE_NEW_SHOPS_STORE ? '✅ 启用' : '❌ 禁用'}
            </FlagStatus>
          </FlagCard>
          
          <FlagCard $enabled={featureFlags.USE_NEW_CUSTOMERS_STORE}>
            <FlagName>客户Store V2</FlagName>
            <FlagStatus $enabled={featureFlags.USE_NEW_CUSTOMERS_STORE}>
              {featureFlags.USE_NEW_CUSTOMERS_STORE ? '✅ 启用' : '❌ 禁用'}
            </FlagStatus>
          </FlagCard>
          
          <FlagCard $enabled={featureFlags.USE_NEW_MESSAGES_STORE}>
            <FlagName>消息Store V2</FlagName>
            <FlagStatus $enabled={featureFlags.USE_NEW_MESSAGES_STORE}>
              {featureFlags.USE_NEW_MESSAGES_STORE ? '✅ 启用' : '❌ 禁用'}
            </FlagStatus>
          </FlagCard>
        </Grid>
        
        <Button onClick={() => cacheManager.debug()}>
          查看缓存统计
        </Button>
        <Button onClick={() => cacheManager.clear()}>
          清空缓存
        </Button>
      </Section>

      {/* 店铺数据测试 */}
      <Section>
        <SectionTitle>🏪 店铺数据测试</SectionTitle>
        <div>
          <Button onClick={reloadShops} disabled={shopsLoading}>
            {shopsLoading ? '加载中...' : '重新加载店铺'}
          </Button>
          <Button onClick={handleTestCreateShop} disabled={creating}>
            {creating ? '创建中...' : '测试创建店铺'}
          </Button>
        </div>
        
        <div style={{ marginTop: theme.spacing.md }}>
          <strong>店铺列表 ({shops.length})</strong>
          {shops.slice(0, 3).map(shop => (
            <DataCard key={shop.id}>
              <div><strong>{shop.shop_name}</strong> (ID: {shop.id})</div>
              <div style={{ fontSize: theme.typography.small, color: theme.colors.text.secondary }}>
                未读: {shop.unread_count || 0} | 角色: {shop.my_role || 'owner'}
              </div>
            </DataCard>
          ))}
          {shops.length > 3 && <div style={{ color: theme.colors.text.secondary }}>...还有 {shops.length - 3} 个店铺</div>}
        </div>
      </Section>

      {/* 客户数据测试 */}
      <Section>
        <SectionTitle>👥 客户数据测试</SectionTitle>
        <div>
          <input
            type="number"
            placeholder="输入店铺ID"
            value={testShopId || ''}
            onChange={e => setTestShopId(Number(e.target.value))}
            style={{ padding: '8px', marginRight: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <Button onClick={reloadCustomers} disabled={customersLoading || !testShopId}>
            {customersLoading ? '加载中...' : '加载客户'}
          </Button>
        </div>
        
        <div style={{ marginTop: theme.spacing.md }}>
          <strong>客户列表 ({customers.length})</strong>
          {customers.slice(0, 5).map(customer => (
            <DataCard key={customer.id}>
              <div><strong>{customer.customer_name || customer.customer_id}</strong></div>
              <div style={{ fontSize: theme.typography.small, color: theme.colors.text.secondary }}>
                最后消息: {customer.last_message || '无'} | 未读: {customer.unread_count}
              </div>
            </DataCard>
          ))}
          {customers.length > 5 && <div style={{ color: theme.colors.text.secondary }}>...还有 {customers.length - 5} 个客户</div>}
        </div>
      </Section>

      {/* 消息数据测试 */}
      <Section>
        <SectionTitle>💬 消息数据测试</SectionTitle>
        <div>
          <input
            type="number"
            placeholder="输入会话ID"
            value={testSessionId || ''}
            onChange={e => setTestSessionId(Number(e.target.value))}
            style={{ padding: '8px', marginRight: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <Button onClick={handleTestSendMessage} disabled={!testSessionId}>
            发送测试消息
          </Button>
        </div>
        
        <div style={{ marginTop: theme.spacing.md }}>
          <strong>消息列表 ({messages.length})</strong>
          {messages.slice(-5).map(msg => (
            <DataCard key={msg.id}>
              <div>
                <strong>{msg.sender_type === 'staff' ? '👨‍💼 客服' : '👤 客户'}</strong>
                {msg.sending && ' (发送中...)'}
                {msg.failed && ' (发送失败)'}
              </div>
              <div style={{ fontSize: theme.typography.small }}>{msg.message}</div>
              <div style={{ fontSize: theme.typography.caption, color: theme.colors.text.secondary }}>
                {new Date(msg.created_at).toLocaleString()}
              </div>
            </DataCard>
          ))}
        </div>
      </Section>

      {/* 使用说明 */}
      <Section>
        <SectionTitle>📖 使用说明</SectionTitle>
        <Code>{`
// 在浏览器控制台中切换Feature Flags:
window.toggleFeature('USE_NEW_SHOPS_STORE', true);
window.toggleFeature('USE_NEW_CACHE', true);

// 查看缓存统计:
window.cache.debug();

// 清空缓存:
window.cache.clear();

// 清空特定前缀的缓存:
window.cache.clearPrefix('shops:');
        `}</Code>
      </Section>
    </Container>
  );
};
