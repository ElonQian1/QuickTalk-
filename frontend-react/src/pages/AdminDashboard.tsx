import React from 'react'

const AdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">管理后台</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">对话统计</h2>
            <div className="text-3xl font-bold text-blue-600">24</div>
            <div className="text-sm text-gray-500">今日活跃对话</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">消息统计</h2>
            <div className="text-3xl font-bold text-green-600">156</div>
            <div className="text-sm text-gray-500">今日消息数</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">客户统计</h2>
            <div className="text-3xl font-bold text-purple-600">89</div>
            <div className="text-sm text-gray-500">注册客户数</div>
          </div>
        </div>
        
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">快速操作</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="p-4 text-center rounded-lg border hover:bg-gray-50">
                <div className="text-sm font-medium">客服管理</div>
              </button>
              <button className="p-4 text-center rounded-lg border hover:bg-gray-50">
                <div className="text-sm font-medium">商店设置</div>
              </button>
              <button className="p-4 text-center rounded-lg border hover:bg-gray-50">
                <div className="text-sm font-medium">系统设置</div>
              </button>
              <button className="p-4 text-center rounded-lg border hover:bg-gray-50">
                <div className="text-sm font-medium">数据导出</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard