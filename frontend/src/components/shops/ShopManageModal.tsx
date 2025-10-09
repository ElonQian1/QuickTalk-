import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/globalStyles';
import type { ShopBasicInfo } from './ShopManageButton';
import { FiX, FiUsers, FiKey, FiInfo, FiCopy, FiPlus } from 'react-icons/fi';
import { StaffList, AddStaffModal, StaffMember } from './staff';
import { listShopStaff, removeShopStaff } from '../../services/staff';
import toast from 'react-hot-toast';
import { API_BASE } from '../../config/api';
import { useAuthStore } from '../../stores/authStore';

interface ShopManageModalProps {
  open: boolean;
  onClose: () => void;
  shop?: ShopBasicInfo; // 若为空不渲染内容
  initialTab?: TabKey;
}

type TabKey = 'info' | 'staff' | 'apiKey';

const Overlay = styled.div<{ open: boolean }>`
  position: fixed; inset:0; background: rgba(0,0,0,0.45);
  display: ${p => p.open ? 'flex' : 'none'}; align-items: center; justify-content: center;
  z-index: 2000; padding: 24px;
`;

const Modal = styled.div`
  background: ${theme.colors.white};
  width: 100%;
  max-width: 48rem; /* 768px */
  max-height: 90dvh;
  border-radius: ${theme.borderRadius.large};
  box-shadow: 0 0.5rem 2rem rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.divider};
`;

const Title = styled.h3`
  margin:0; font-size: ${theme.typography.h3}; font-weight:600; display:flex; align-items:center; gap:8px;
`;

const CloseBtn = styled.button`
  background: transparent; border:none; cursor:pointer; font-size:20px; color:${theme.colors.text.secondary}; padding:4px;
  &:hover{color:${theme.colors.text.primary};}
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid ${theme.colors.divider};
  flex-wrap: wrap;
`;

const TabButton = styled.button<{ active?: boolean }>`
  background: ${p => p.active ? theme.colors.primary : 'transparent'};
  color: ${p => p.active ? theme.colors.white : theme.colors.text.primary};
  border: 1px solid ${p => p.active ? theme.colors.primary : theme.colors.border};
  padding: 0.4rem 0.9rem;
  border-radius: 1.25rem;
  font-size: ${theme.typography.small};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  &:hover { background: ${p => p.active ? '#059246' : theme.colors.background}; }
`;

const Body = styled.div`
  padding: ${theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.lg};
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Label = styled.label`
  font-size:${theme.typography.caption}; text-transform:uppercase; letter-spacing:.5px; color:${theme.colors.text.secondary};
`;

const ValueBox = styled.div`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  padding: 0.625rem 0.875rem;
  border-radius: ${theme.borderRadius.medium};
  font-size: ${theme.typography.small};
  word-break: break-all;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const Muted = styled.span`
  color:${theme.colors.text.placeholder}; font-style:italic;
`;

const InlineButton = styled.button`
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  color: ${theme.colors.text.secondary};
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  &:hover { color: ${theme.colors.primary}; border-color: ${theme.colors.primary}; }
`;

const Empty = styled.div`
  text-align: center;
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.small};
  padding: ${theme.spacing.lg} 0;
`;

const ApiKeyBox = styled(ValueBox)`
  flex-direction: row;
  position: relative;
`;

// StaffMember 类型来自 staff 子模块

const ShopManageModal: React.FC<ShopManageModalProps> = ({ open, onClose, shop, initialTab='info' }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (open && activeTab === 'staff' && shop) {
      fetchStaff();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, open, shop?.id]);

  const fetchStaff = async () => {
    if (!shop) return;
    setLoadingStaff(true);
    try {
  const res = await listShopStaff(shop.id);
  setStaff(res.map(s => ({ id: s.id, username: s.username, role: s.role })));
    } catch (err: any) {
      console.warn('获取员工列表失败(可能尚未实现后端接口):', err?.response?.status);
      if (err?.response?.status === 404) {
        toast('员工管理接口尚未实现');
      } else {
        toast.error('获取员工失败');
      }
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleRemove = async (member: StaffMember) => {
    if (!shop) return;
    if (!window.confirm(`确认将 ${member.username} 从该店铺移除吗？`)) return;
    try {
      await removeShopStaff(shop.id, member.id);
      toast.success('已移除');
      fetchStaff();
    } catch (err: any) {
      const code = err?.response?.data?.error || err?.response?.status;
      if (code === 'cannot_remove_owner') {
        toast.error('不能移除店主');
      } else if (err?.response?.status === 401) {
        toast.error('无权限执行此操作');
      } else if (err?.response?.status === 404) {
        toast.error('员工不存在');
      } else {
        toast.error('移除失败');
      }
    }
  };

  if (!shop) return null;

  const copyKey = () => {
    if (!shop.api_key) return;
    navigator.clipboard.writeText(shop.api_key).then(() => toast.success('API Key 已复制'));
  };

  const copyEmbedCode = async () => {
    if (!shop?.api_key) {
      toast.error('该店铺暂无 API Key');
      return;
    }
    const serverUrl = API_BASE.replace(/\/$/, '');
  const embed = `\
<script>(function(){\n  var CONFIG = {\n    serverUrl: '${serverUrl}',\n    shopId: '${shop.api_key}',\n    authorizedDomain: '',\n    cache: Date.now()\n  };\n  var host = window.location.hostname;\n  if (CONFIG.authorizedDomain && host !== CONFIG.authorizedDomain && !host.endsWith('.' + CONFIG.authorizedDomain) && host !== 'localhost') {\n    console.error('❌ 域名未授权:', host, '期望:', CONFIG.authorizedDomain);\n    return;\n  }\n  var BASE = (CONFIG.serverUrl && CONFIG.serverUrl.endsWith('/')) ? CONFIG.serverUrl.slice(0, -1) : CONFIG.serverUrl;\n  var link = document.createElement('link');\n  link.rel = 'stylesheet';\n  link.href = BASE + '/static/embed/styles.css?v=' + CONFIG.cache;\n  link.charset = 'utf-8';\n  link.onerror = function(){ console.error('❌ 客服样式加载失败'); };\n  document.head.appendChild(link);\n  var s = document.createElement('script');\n  s.src = BASE + '/static/embed/service-standalone.js?v=' + CONFIG.cache;\n  s.charset = 'utf-8';\n  s.onload = function(){\n    if (window.QuickTalkCustomerService) {\n      window.QuickTalkCustomerService.init({ shopId: CONFIG.shopId, serverUrl: CONFIG.serverUrl });\n      console.log('✅ 客服浮窗已初始化');\n    } else {\n      console.error('❌ 客服兼容层未就绪');\n    }\n  };\n  s.onerror = function(){ console.error('❌ 客服脚本加载失败'); };\n  document.head.appendChild(s);\n})();</script>`;
    try {
      await navigator.clipboard.writeText(embed);
      toast.success('嵌入代码已复制');
    } catch (e) {
      console.error(e);
      toast.error('复制失败');
    }
  };

  return (
    <Overlay open={open} onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <Header>
          <Title>管理：{shop.shop_name}</Title>
          <CloseBtn onClick={onClose} aria-label="关闭"><FiX /></CloseBtn>
        </Header>
        <Tabs>
          <TabButton active={activeTab==='info'} onClick={() => setActiveTab('info')}><FiInfo /> 店铺信息</TabButton>
          <TabButton active={activeTab==='staff'} onClick={() => setActiveTab('staff')}><FiUsers /> 员工管理</TabButton>
          <TabButton active={activeTab==='apiKey'} onClick={() => setActiveTab('apiKey')}><FiKey /> API Key</TabButton>
        </Tabs>
        <Body>
          {activeTab === 'info' && (
            <Section>
              <FieldRow>
                <Label>店铺名称</Label>
                <ValueBox>{shop.shop_name}</ValueBox>
              </FieldRow>
              <FieldRow>
                <Label>店铺网址</Label>
                <ValueBox>{shop.shop_url ? shop.shop_url : <Muted>未设置</Muted>}</ValueBox>
              </FieldRow>
              <FieldRow>
                <Label>店铺 ID</Label>
                <ValueBox>{shop.id}</ValueBox>
              </FieldRow>
            </Section>
          )}
          {activeTab === 'staff' && (
            <Section>
              {staff.some(s => s.role === 'owner' && s.id === (user?.id ?? -1)) && (
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <InlineButton onClick={() => setShowAdd(true)}><FiPlus /> 添加员工</InlineButton>
                </div>
              )}
              {loadingStaff ? <Empty>加载中...</Empty> : (
                staff.length ? (
                  <StaffList data={staff} onRemove={handleRemove} canRemove={staff.some(s => s.role === 'owner' && s.id === (user?.id ?? -1))} />
                ) : <Empty>暂无员工</Empty>
              )}
            </Section>
          )}
          {activeTab === 'apiKey' && (
            <Section>
              <FieldRow>
                <Label>当前 API Key</Label>
                <ApiKeyBox>
                  <span style={{ flex:1 }}>{shop.api_key ? shop.api_key : <Muted>暂无</Muted>}</span>
                  {shop.api_key && <InlineButton onClick={copyKey}><FiCopy /> 复制</InlineButton>}
                </ApiKeyBox>
                <Muted>请妥善保管，后续可添加重置功能。</Muted>
                <div style={{ marginTop: 8 }}>
                  <InlineButton onClick={copyEmbedCode}><FiCopy /> 复制嵌入代码</InlineButton>
                </div>
              </FieldRow>
            </Section>
          )}
        </Body>
      </Modal>
      <AddStaffModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        shopId={shop?.id}
        onAdded={() => fetchStaff()}
      />
    </Overlay>
  );
};

export default ShopManageModal;
