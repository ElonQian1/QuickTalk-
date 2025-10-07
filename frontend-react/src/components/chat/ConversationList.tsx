import React from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Conversation, ConversationListProps } from '@/types'
import { Badge } from '@/components/ui/Badge'

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
}) => {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-lg mb-2">暂无对话</div>
        <div className="text-sm">等待客户发起对话</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 border-b">
        <h2 className="font-semibold text-gray-800">对话列表</h2>
        <div className="text-sm text-gray-500 mt-1">
          {conversations.length} 个活跃对话
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={conversation.id === selectedConversationId}
            onClick={() => onSelectConversation(conversation)}
          />
        ))}
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onClick,
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'MM-dd HH:mm', { locale: zhCN })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="success">进行中</Badge>
      case 'closed':
        return <Badge variant="secondary">已关闭</Badge>
      case 'pending':
        return <Badge variant="warning">等待中</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div
      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {conversation.customer?.name || `客户 #${conversation.customer_id}`}
          </div>
          <div className="text-sm text-gray-500 truncate">
            {conversation.shop?.name || `商店 #${conversation.shop_id}`}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {getStatusBadge(conversation.status)}
          {conversation.unread_count && conversation.unread_count > 0 && (
            <Badge variant="danger" size="sm">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
      
      {conversation.last_message && (
        <div className="text-sm text-gray-600 line-clamp-2 mb-2">
          <span className="font-medium">
            {conversation.last_message.sender_type === 'customer' ? '客户' : '客服'}:
          </span>{' '}
          {conversation.last_message.content}
        </div>
      )}
      
      <div className="text-xs text-gray-400">
        {formatTime(conversation.updated_at)}
      </div>
    </div>
  )
}

export default ConversationList