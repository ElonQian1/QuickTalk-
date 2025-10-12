import React, { useState } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../stores/authStore';
import { Button, Input, Card } from '../styles/globalStyles';
import { theme } from '../styles/globalStyles';

const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${theme.spacing.md};
  background: linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%);
`;

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 400px;
  padding: ${theme.spacing.xl};
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: ${theme.spacing.xl};
`;

const LogoIcon = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto ${theme.spacing.md};
  background: ${theme.colors.primary};
  border-radius: ${theme.borderRadius.large};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  font-size: 32px;
  font-weight: bold;
`;

const LogoText = styled.h1`
  font-size: ${theme.typography.h2};
  color: ${theme.colors.text.primary};
  font-weight: 600;
`;

const LogoSubtitle = styled.p`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.small};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Label = styled.label`
  font-size: ${theme.typography.small};
  font-weight: 500;
  color: ${theme.colors.text.primary};
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: ${theme.spacing.lg};
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.small};
  padding: 4px;
`;

const Tab = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: none;
  background: ${props => props.active ? theme.colors.white : 'transparent'};
  color: ${props => props.active ? theme.colors.text.primary : theme.colors.text.secondary};
  border-radius: ${theme.borderRadius.small};
  font-size: ${theme.typography.small};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${props => props.active ? theme.shadows.card : 'none'};
`;

const ErrorMessage = styled.div`
  color: ${theme.colors.danger};
  font-size: ${theme.typography.small};
  text-align: center;
  margin-top: ${theme.spacing.sm};
`;

const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register } = useAuthStore();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('请填写用户名和密码');
      return;
    }

    if (activeTab === 'register') {
      if (!formData.confirmPassword) {
        setError('请再次输入密码进行确认');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      let success = false;
      
      if (activeTab === 'login') {
        success = await login(formData.username, formData.password);
      } else {
        success = await register(
          formData.username,
          formData.password,
          formData.email || undefined,
          formData.phone || undefined
        );
      }

      if (!success) {
        setError(activeTab === 'login' ? '登录失败，请检查用户名和密码' : '注册失败，请重试');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <LoginCard className="fade-in">
        <Logo>
          <LogoIcon>客</LogoIcon>
          <LogoText>客服后台</LogoText>
          <LogoSubtitle>多店铺客服管理系统</LogoSubtitle>
        </Logo>

        <TabContainer>
          <Tab
            active={activeTab === 'login'}
            onClick={() => setActiveTab('login')}
            type="button"
          >
            登录
          </Tab>
          <Tab
            active={activeTab === 'register'}
            onClick={() => setActiveTab('register')}
            type="button"
          >
            注册
          </Tab>
        </TabContainer>

        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="请输入用户名"
              value={formData.username}
              onChange={handleInputChange}
              autoComplete="username"
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="请输入密码"
              value={formData.password}
              onChange={handleInputChange}
              autoComplete={activeTab === 'register' ? 'new-password' : 'current-password'}
            />
          </FormGroup>

          {activeTab === 'register' && (
            <>
              <FormGroup>
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="email">邮箱（可选）</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="请输入邮箱"
                  value={formData.email}
                  onChange={handleInputChange}
                  autoComplete="email"
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="phone">手机号（可选）</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={handleInputChange}
                  autoComplete="tel"
                />
              </FormGroup>
            </>
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={loading}
          >
            {loading ? '请稍候...' : (activeTab === 'login' ? '登录' : '注册')}
          </Button>
        </Form>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginPage;