// Mock数据服务 - 当后端不可用时使用
export const mockData = {
  shops: [
    {
      id: 1,
      shop_name: '示例店铺 1',
      shop_url: 'https://example1.com',
      owner_id: 1,
      api_key: 'mock-api-key-1',
      status: 1,
      created_at: '2025-10-08T10:00:00Z'
    },
    {
      id: 2,
      shop_name: '示例店铺 2',
      shop_url: 'https://example2.com',
      owner_id: 1,
      api_key: 'mock-api-key-2',
      status: 1,
      created_at: '2025-10-08T09:00:00Z'
    }
  ],
  
  customers: [
    {
      id: 1,
      shop_id: 1,
      customer_id: 'cust_001',
      customer_name: '张三',
      customer_email: 'zhangsan@example.com',
      unread_count: 3,
      last_active_at: '2025-10-08T11:30:00Z',
      status: 1,
      last_message: {
        content: '请问有什么优惠活动吗？',
        created_at: '2025-10-08T11:30:00Z',
        sender_type: 'customer'
      }
    },
    {
      id: 2,
      shop_id: 1,
      customer_id: 'cust_002',
      customer_name: '李四',
      customer_email: 'lisi@example.com',
      unread_count: 1,
      last_active_at: '2025-10-08T11:00:00Z',
      status: 1,
      last_message: {
        content: '订单什么时候发货？',
        created_at: '2025-10-08T11:00:00Z',
        sender_type: 'customer'
      }
    }
  ],

  stats: {
    total_shops: 2,
    total_customers: 5,
    total_messages: 48,
    active_sessions: 3,
    response_time: '< 1分钟',
    satisfaction_rate: '98%'
  },

  messages: []
};

// 模拟API延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  async getShops() {
    await delay(500);
    return mockData.shops;
  },

  async getCustomers(shopId: number) {
    await delay(300);
    return mockData.customers.filter(c => c.shop_id === shopId);
  },

  async getStats() {
    await delay(400);
    return mockData.stats;
  },

  async getMessages(sessionId: number) {
    await delay(300);
    return mockData.messages.filter((m: any) => m.session_id === sessionId);
  }
};