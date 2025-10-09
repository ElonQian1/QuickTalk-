import React from 'react';
import styled from 'styled-components';
import { theme } from '../../../styles/globalStyles';

export interface StaffMember { id: number; username: string; role?: string; }

interface StaffListProps {
  data: StaffMember[];
  loading?: boolean;
  onRefresh?: () => void;
  onSelect?: (staff: StaffMember) => void;
  onRemove?: (staff: StaffMember) => void;
  canRemove?: boolean;
}

const List = styled.ul`
  list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px;
`;

const Item = styled.li`
  background:${theme.colors.background}; border:1px solid ${theme.colors.border};
  padding:10px 14px; border-radius:${theme.borderRadius.small};
  display:flex; justify-content:space-between; align-items:center; font-size:${theme.typography.small};
`;

const Role = styled.span`
  color:${theme.colors.text.secondary}; font-size:12px;
`;

const Empty = styled.div`
  text-align:center; color:${theme.colors.text.secondary}; font-size:${theme.typography.small}; padding:24px 0;
`;

const RemoveBtn = styled.button`
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  color: ${theme.colors.danger || '#d33'};
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  &:hover { border-color: ${theme.colors.danger || '#d33'}; }
`;

const Right = styled.div`
  display:flex; align-items:center; gap:8px;
`;

const StaffList: React.FC<StaffListProps> = ({ data, loading, onSelect, onRemove, canRemove }) => {
  if (loading) return <Empty>加载中...</Empty>;
  if (!data.length) return <Empty>暂无员工</Empty>;
  return (
    <List>
      {data.map(s => (
        <Item key={s.id}>
          <span onClick={() => onSelect?.(s)} style={{ cursor:'pointer' }}>{s.username}</span>
          <Right>
            <Role>{s.role || '成员'}</Role>
            {canRemove && s.role !== 'owner' && (
              <RemoveBtn onClick={() => onRemove?.(s)}>移除</RemoveBtn>
            )}
          </Right>
        </Item>
      ))}
    </List>
  );
};

export default StaffList;
