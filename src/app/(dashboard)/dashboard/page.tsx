'use client'

import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function DashboardPage() {
  const { data: session } = useSession()

  const stats = [
    { name: '待审批加班', value: '0', icon: '⏰' },
    { name: '待审批请假', value: '0', icon: '📅' },
    { name: '本月绩效', value: '-', icon: '📈' },
    { name: '年假余额', value: '-', icon: '🏖️' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">欢迎回来，{session?.user?.name}！</h1>
        <p className="text-gray-600 mt-1">
          角色：{session?.user?.role === 'ADMIN' ? '系统管理员' : session?.user?.role === 'MANAGER' ? '主管' : '员工'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <span className="text-2xl">{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session?.user?.role === 'EMPLOYEE' && (
              <>
                <a href="/dashboard/overtime/new" className="block p-3 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                  <span className="font-medium text-blue-700">→ 提交加班申请</span>
                </a>
                <a href="/dashboard/leave/new" className="block p-3 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                  <span className="font-medium text-green-700">→ 提交请假申请</span>
                </a>
                <a href="/dashboard/performance/new" className="block p-3 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors">
                  <span className="font-medium text-purple-700">→ 填写绩效</span>
                </a>
              </>
            )}
            {(session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN') && (
              <a href="/dashboard/approvals" className="block p-3 bg-yellow-50 rounded-md hover:bg-yellow-100 transition-colors">
                <span className="font-medium text-yellow-700">→ 处理审批</span>
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统公告</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <p>• 欢迎使用劳务派遣员工管理系统</p>
                <p>• 请按时完成月度绩效填写</p>
                <p>• 加班申请需提前 1 天提交</p>
                <p>• 请假申请请确保假期余额充足</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
