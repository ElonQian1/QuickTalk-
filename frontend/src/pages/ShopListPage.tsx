import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiMessageCircle, FiGlobe } from 'react-icons/fi';
import { api } from '../config/api';
import { Button, Card, Avatar, Badge, LoadingSpinner } from '../styles/globalStyles';
import { theme } from '../styles/globalStyles';
import toast from 'react-hot-toast';
import CreateShopModal from '../components/CreateShopModal';

const Container = styled.div`
  padding: ${theme.spacing.md};
  height: 100%;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.lg};
`;

const Title = styled.h2`
  font-size: ${theme.typography.h2};
  color: ${theme.colors.text.primary};
`;

const ShopList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const ShopCard = styled(Card)`
  padding: ${theme.spacing.md};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ShopHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.sm};
`;

const ShopIcon = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  background: ${theme.colors.primary};
  border-radius: ${theme.borderRadius.medium};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  font-size: 20px;
  font-weight: bold;
`;

const ShopInfo = styled.div`
  flex: 1;
  overflow: hidden;
`;

const ShopName = styled.h3`
  font-size: ${theme.typography.body};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ShopUrl = styled.p`
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ShopStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${theme.spacing.sm};
  padding-top: ${theme.spacing.sm};
  border-top: 1px solid ${theme.colors.divider};
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
`;

const StatValue = styled.span`
  font-weight: 600;
  color: ${theme.colors.text.primary};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xl} ${theme.spacing.md};
  color: ${theme.colors.text.secondary};
`;

const EmptyIcon = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto ${theme.spacing.md};
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.round};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: ${theme.colors.text.placeholder};
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`;

interface Shop {
  id: number;
  shop_name: string;
  shop_url?: string;
  api_key: string;
  created_at: string;
  unread_count?: number;
}

const ShopListPage: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const response = await api.get('/api/shops');
      console.log('📋 获取到的店铺数据:', response.data);
      setShops(response.data);
    } catch (error) {
      toast.error('获取店铺列表失败');
      console.error('Error fetching shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShopClick = (shop: Shop) => {
    navigate(`/shops/${shop.id}/customers`);
  };

  const handleCreateShop = () => {
    setIsCreateModalOpen(true);
  };

  const createShop = async (shopName: string, shopUrl?: string) => {
    try {
      const response = await api.post('/api/shops', {
        shop_name: shopName,
        shop_url: shopUrl,
      });
      
      setShops([response.data, ...shops]);
      toast.success('店铺创建成功');
    } catch (error) {
      toast.error('创建店铺失败');
      console.error('Error creating shop:', error);
      throw error; // 重新抛出错误，让模态框知道创建失败
    }
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>我的店铺</Title>
        <Button
          variant="primary"
          size="small"
          onClick={handleCreateShop}
        >
          <FiPlus style={{ marginRight: '4px' }} />
          添加店铺
        </Button>
      </Header>

      {shops.length === 0 ? (
        <EmptyState>
          <EmptyIcon>🏪</EmptyIcon>
          <h3>还没有店铺</h3>
          <p>点击右上角添加按钮创建您的第一个店铺</p>
        </EmptyState>
      ) : (
        <ShopList>
          {shops.map((shop) => {
            console.log('🏪 渲染店铺:', shop.shop_name, '未读消息:', shop.unread_count, 'API Key:', shop.api_key);
            return (
              <ShopCard
                key={shop.id}
                onClick={() => handleShopClick(shop)}
                className="fade-in"
              >
              <ShopHeader>
                <ShopIcon style={{ position: 'relative' }}>
                  🏪
                  {shop.unread_count && shop.unread_count > 0 && (
                    <Badge count={shop.unread_count} />
                  )}
                </ShopIcon>
                
                <ShopInfo>
                  <ShopName>{shop.shop_name}</ShopName>
                  {shop.shop_url && (
                    <ShopUrl>
                      <FiGlobe />
                      {shop.shop_url.replace(/^https?:\/\//, '')}
                    </ShopUrl>
                  )}
                </ShopInfo>
              </ShopHeader>

              <ShopStats>
                <StatItem>
                  <FiMessageCircle />
                  未读消息: <StatValue>{shop.unread_count || 0}</StatValue>
                </StatItem>
                <StatItem>
                  API Key: <StatValue>{shop.api_key ? shop.api_key.substring(0, 8) + '...' : 'N/A'}</StatValue>
                </StatItem>
              </ShopStats>
            </ShopCard>
            );
          })}
        </ShopList>
      )}
      
      <CreateShopModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createShop}
      />
    </Container>
  );
};

export default ShopListPage;