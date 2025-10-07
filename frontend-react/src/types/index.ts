// Base types from backend API
export interface Shop {
  id: number;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  shop_id: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  customer_id: number;
  shop_id: number;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
  updated_at: string;
  // Computed fields
  customer?: Customer;
  shop?: Shop;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_type: 'customer' | 'agent';
  sender_id: number;
  content: string;
  message_type: 'text' | 'image' | 'file';
  file_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: number;
  username: string;
  email?: string;
  role: 'admin' | 'super_admin';
  shop_id?: number;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  per_page: number;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  page: number;
  per_page: number;
}

// WebSocket message types
export interface WSMessage {
  type: 'new_message' | 'conversation_update' | 'user_typing' | 'system';
  data: any;
  timestamp: string;
}

// Component props types
export interface ChatProps {
  conversation?: Conversation;
  onSendMessage: (content: string, type?: 'text' | 'image') => void;
}

export interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: number;
  onSelectConversation: (conversation: Conversation) => void;
}

// Form types
export interface SendMessageForm {
  content: string;
  type: 'text' | 'image' | 'file';
  file?: File;
}

export interface LoginForm {
  username: string;
  password: string;
}