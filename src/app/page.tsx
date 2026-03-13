import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-blue-600">劳务派遣员工管理系统</h1>
          <p className="text-gray-600 mt-4 text-lg">
            高效管理加班、请假、绩效和审批流程
          </p>
        </div>
        
        <div className="flex space-x-4 justify-center">
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            登录系统
          </Link>
          <Link
            href="/auth/register"
            className="px-6 py-3 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors font-medium"
          >
            注册账号
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-12">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-2">⏰</div>
            <h3 className="font-semibold">加班申请</h3>
            <p className="text-sm text-gray-600 mt-2">在线提交和管理加班申请</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-2">📅</div>
            <h3 className="font-semibold">请假管理</h3>
            <p className="text-sm text-gray-600 mt-2">假期余额查询和请假申请</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-2">📈</div>
            <h3 className="font-semibold">绩效管理</h3>
            <p className="text-sm text-gray-600 mt-2">多维度绩效评估和统计</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="font-semibold">流程审批</h3>
            <p className="text-sm text-gray-600 mt-2">便捷的在线审批流程</p>
          </div>
        </div>
      </div>
    </div>
  )
}
