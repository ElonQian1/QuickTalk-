import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { theme, Card, Button } from '../../styles/globalStyles';
import { FiUsers, FiGlobe, FiSettings } from 'react-icons/fi';
import { listStaffShops, ShopItem } from '../../services/shops';
import { ShopManageModal } from '../shops';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationsStore } from '../../stores/notificationsStore';

const Container = styled.div`
  padding: ${theme.spacing.md};
  height: 100%;
  overflow-y: auto;
`;

const Title = styled.h2`
  font-size: ${theme.typography.h2};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.lg};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const Item = styled(Card)`
  padding: ${theme.spacing.md};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Info = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`;

const Name = styled.div`
  font-weight: 600;
`;

const Url = styled.div`
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
  display:flex; align-items:center; gap:6px;
`;

const Badge = styled.span`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 12px;
  color: ${theme.colors.text.secondary};
`;

const SmallMuted = styled.span`
  color:${theme.colors.text.secondary}; font-size:12px;
`;

const StaffShopList: React.FC = () => {
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ShopItem | undefined>();
  const { user } = useAuthStore();
  const byShop = useNotificationsStore(state => state.byShop);

  useEffect(() => {
    listStaffShops().then(setShops).catch(() => {
      // 静默失败提示由全局 Toast 兜底
    });
  }, []);

  const openManage = (shop: ShopItem) => {
    setActive(shop);
    setOpen(true);
  };

  return (
    <Container>
      <Title>我加入的店铺</Title>
      {shops.length === 0 ? (
        <SmallMuted>暂无加入的店铺</SmallMuted>
      ) : (
        <List>
          {shops.map(s => (
            <Item key={s.id}>
              <Info>
                <Badge><FiUsers /> 员工</Badge>
                <div>
                  <Name>{s.shop_name}</Name>
                  {s.shop_url && (
                    <Url><FiGlobe />{s.shop_url.replace(/^https?:\/\//,'')}</Url>
                  )}
                </div>
              </Info>
              <div style={{ display:'flex', gap:8 }}>
                <Badge>未读 {byShop[s.id] ?? s.unread_count ?? 0}</Badge>
                <Button size="small" variant="secondary" onClick={() => openManage(s)}>
                  <FiSettings style={{ marginRight: 4 }} /> 管理
                </Button>
              </div>
            </Item>
          ))}
        </List>
      )}
  <ShopManageModal open={open} onClose={() => setOpen(false)} shop={active as any} initialTab="info" mode="staff" />
    </Container>
  );
};

export default StaffShopList;
