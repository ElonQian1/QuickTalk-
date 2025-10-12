import React, { useState } from 'react';
import styled from 'styled-components';
import { FiChevronLeft } from 'react-icons/fi';
import { api } from '../../../config/api';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';

const Container = styled.div`
  position: fixed;
  inset: 0;
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

  &:hover { background: #f8f9fa; }
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const Content = styled.div`
  padding: 16px 20px 80px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
`;

const Tab = styled.button<{ active: boolean }>`
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  background: ${p => (p.active ? '#00d4aa' : '#e9ecef')};
  color: ${p => (p.active ? 'white' : '#333')};
`;

const Section = styled.div`
  background: white;
  margin: 12px 0;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
`;

const Label = styled.label`
  color: #666;
  font-size: 14px;
`;

const Input = styled.input`
  height: 36px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 0 10px;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
`;

const Button = styled.button<{ primary?: boolean }>`
  border: none;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  background: ${p => (p.primary ? '#00d4aa' : '#e9ecef')};
  color: ${p => (p.primary ? 'white' : '#333')};
`;

const Hint = styled.div`
  grid-column: 2 / 3;
  color: #dc3545;
  font-size: 12px;
  margin-top: -6px;
`;

interface PersonalInfoModalProps { isOpen: boolean; onClose: () => void; }

const PersonalInfoModal: React.FC<PersonalInfoModalProps> = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });

  if (!isOpen) return null;

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        email: form.email || undefined,
        phone: form.phone || undefined,
      };
      const res = await api.put('/api/user/profile', payload);
      // 更新本地用户信息（与后端返回保持一致）
      if (res?.data) {
        setUser(res.data);
        toast.success('资料已保存');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        toast.error('邮箱或手机号已被占用');
      } else if (status === 400) {
        const msg = err?.response?.data?.message || '提交的数据无效';
        toast.error(`保存失败：${msg}`);
      } else {
        toast.error('保存失败，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!pwd.current_password || !pwd.new_password) return;
    if (pwd.new_password !== pwd.confirm_password) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await api.put('/api/user/password', {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      });
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('密码修改成功');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400) {
        const msg = err?.response?.data?.message || '当前密码不正确或新密码不符合要求';
        toast.error(msg);
      } else if (status === 401) {
        toast.error('登录已过期，请重新登录');
      } else {
        toast.error('修改失败，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={onClose}><FiChevronLeft /></BackButton>
        <HeaderTitle>个人信息</HeaderTitle>
      </Header>

      <Content>
        <Tabs>
          <Tab active={activeTab==='profile'} onClick={() => setActiveTab('profile')}>资料</Tab>
          <Tab active={activeTab==='password'} onClick={() => setActiveTab('password')}>密码</Tab>
        </Tabs>

        {activeTab === 'profile' && (
          <Section>
            <Row>
              <Label>用户名</Label>
              <Input value={form.username} disabled readOnly />
            </Row>
            <Row><Label>邮箱</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></Row>
            <Row><Label>手机号</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} /></Row>
            <Actions>
              <Button onClick={onClose}>取消</Button>
              <Button primary disabled={saving} onClick={saveProfile}>保存</Button>
            </Actions>
          </Section>
        )}

        {activeTab === 'password' && (
          <Section>
            <Row><Label>当前密码</Label><Input type="password" value={pwd.current_password} onChange={e=>setPwd({...pwd, current_password:e.target.value})} /></Row>
            <Row><Label>新密码</Label><Input type="password" value={pwd.new_password} onChange={e=>setPwd({...pwd, new_password:e.target.value})} /></Row>
            <Row><Label>确认新密码</Label><Input type="password" value={pwd.confirm_password} onChange={e=>setPwd({...pwd, confirm_password:e.target.value})} /></Row>
            <Actions>
              <Button onClick={onClose}>取消</Button>
              <Button
                primary
                disabled={
                  saving ||
                  !pwd.current_password ||
                  !pwd.new_password ||
                  !pwd.confirm_password
                }
                onClick={changePassword}
              >
                修改
              </Button>
            </Actions>
            {pwd.new_password && pwd.confirm_password && pwd.new_password !== pwd.confirm_password && (
              <Hint>两次输入的新密码不一致</Hint>
            )}
          </Section>
        )}
      </Content>
    </Container>
  );
};

export default PersonalInfoModal;
