import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../../../styles/globalStyles';
import { addShopStaff } from '../../../services/staff';
import toast from 'react-hot-toast';

interface AddStaffModalProps {
  open: boolean;
  shopId: number | undefined;
  onClose: () => void;
  onAdded: () => void; // 刷新列表
}

const Overlay = styled.div<{ open: boolean }>`
  position: fixed; inset:0; background:rgba(0,0,0,0.45);
  display:${p => p.open ? 'flex' : 'none'}; align-items:center; justify-content:center; z-index:3000; padding:24px;
`;

const Modal = styled.div`
  background:${theme.colors.white}; width:100%; max-width:420px; border-radius:${theme.borderRadius.large};
  box-shadow:0 6px 24px rgba(0,0,0,0.15); padding:28px 28px 32px; display:flex; flex-direction:column; gap:20px;
`;

const Title = styled.h3`margin:0; font-size:${theme.typography.h3}; font-weight:600;`;

const Field = styled.div`display:flex; flex-direction:column; gap:6px;`;
const Label = styled.label`font-size:${theme.typography.small}; color:${theme.colors.text.secondary}; font-weight:500;`;
const Input = styled.input`
  padding:10px 14px; border:1px solid ${theme.colors.border}; border-radius:${theme.borderRadius.small};
  font-size:${theme.typography.body}; background:${theme.colors.white};
  &:focus{outline:none; border-color:${theme.colors.primary};}
`;

const Actions = styled.div`display:flex; justify-content:flex-end; gap:12px; margin-top:8px;`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding:10px 18px; font-size:${theme.typography.small}; border-radius:${theme.borderRadius.small}; cursor:pointer;
  border:1px solid transparent; font-weight:500; display:inline-flex; align-items:center; gap:6px;
  ${p => p.variant === 'primary' ? `background:${theme.colors.primary}; color:${theme.colors.white}; &:hover{background:#059246;}` : `background:${theme.colors.background}; color:${theme.colors.text.primary}; border-color:${theme.colors.border}; &:hover{background:#e9e9e9;}`};
  &:disabled{opacity:.6; cursor:not-allowed;}
`;

const ErrorText = styled.div`color:${theme.colors.danger}; font-size:12px;`;

const AddStaffModal: React.FC<AddStaffModalProps> = ({ open, onClose, shopId, onAdded }) => {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setUsername('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
  await addShopStaff(shopId, username.trim());
      toast.success('员工已添加');
      onAdded();
      reset();
      onClose();
    } catch (err: any) {
      console.error('添加员工失败', err);
      console.log('🔍 错误响应详情:', {
        status: err?.response?.status,
        data: err?.response?.data,
        code: err?.response?.data?.code,
        message: err?.response?.data?.message
      });
      
      const code = err?.response?.data?.code || '';
      const msg = err?.response?.data?.message || '';
      
      if (code === 'BAD_REQUEST' && msg === 'user_not_found') {
        setError('用户不存在，请确认用户名');
      } else if (code === 'BAD_REQUEST' && msg === 'already_member') {
        setError('该用户已是本店员工');
      } else if (code === 'BAD_REQUEST' && msg === 'username_required') {
        setError('请输入用户名');
      } else if (code === 'BAD_REQUEST' && msg === 'invalid_shop_or_user') {
        setError('店铺不存在或用户数据无效');
      } else if ((code === 'BAD_REQUEST' || code === 'INTERNAL_ERROR') && msg === 'add_staff_failed') {
        setError('添加失败，请稍后重试');
      } else if (code === 'UNAUTHORIZED') {
        setError('暂无权限进行此操作');
      } else {
        setError(`添加失败: ${msg || '未知错误'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay open={open} onClick={() => !submitting && onClose()}>
      <Modal onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <Title>添加员工</Title>
          <Field>
            <Label>用户名</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="输入系统已注册的用户名" disabled={submitting} />
          </Field>
          {/* 角色固定为普通员工，去掉下拉 */}
          {error && <ErrorText>{error}</ErrorText>}
          <Actions>
            <Button type="button" onClick={onClose} disabled={submitting}>取消</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? '提交中...' : '确认添加'}</Button>
          </Actions>
        </form>
      </Modal>
    </Overlay>
  );
};

export default AddStaffModal;
