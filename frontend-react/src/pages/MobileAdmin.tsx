import React from 'react'

const MobileAdmin: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-blue-600 text-white px-4 py-3">
        <h1 className="text-lg font-semibold">移动端管理</h1>
      </header>
      
      {/* Quick Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">12</div>
            <div className="text-sm text-gray-600">活跃对话</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">48</div>
            <div className="text-sm text-gray-600">今日消息</div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="space-y-3">
          <button className="w-full bg-white rounded-lg shadow p-4 text-left hover:bg-gray-50">
            <div className="font-medium">对话管理</div>
            <div className="text-sm text-gray-500">查看和管理客户对话</div>
          </button>
          
          <button className="w-full bg-white rounded-lg shadow p-4 text-left hover:bg-gray-50">
            <div className="font-medium">客户管理</div>
            <div className="text-sm text-gray-500">管理客户信息和状态</div>
          </button>
          
          <button className="w-full bg-white rounded-lg shadow p-4 text-left hover:bg-gray-50">
            <div className="font-medium">系统设置</div>
            <div className="text-sm text-gray-500">配置系统参数</div>
          </button>
          
          <button className="w-full bg-white rounded-lg shadow p-4 text-left hover:bg-gray-50">
            <div className="font-medium">数据统计</div>
            <div className="text-sm text-gray-500">查看业务数据报表</div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default MobileAdmin