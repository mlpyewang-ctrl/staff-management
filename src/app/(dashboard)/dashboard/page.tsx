'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { getOvertimeStats } from '@/server/actions/overtime'
import { getLeaveStats } from '@/server/actions/leave'
import { getDepartments } from '@/server/actions/department'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [overtimeHours, setOvertimeHours] = useState<number>(0)
  const [leaveDays, setLeaveDays] = useState<number>(0)
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      if (!session?.user) return

      setLoading(true)

      const isEmployee = session.user.role === 'EMPLOYEE'
      const userId = isEmployee ? session.user.id : undefined
      const deptId = !isEmployee && selectedDepartment ? selectedDepartment : undefined

      const [hours, days, depts] = await Promise.all([
        getOvertimeStats(userId, deptId),
        getLeaveStats(userId, deptId),
        isEmployee ? Promise.resolve([]) : getDepartments(),
      ])

      setOvertimeHours(hours)
      setLeaveDays(days)
      setDepartments(depts)
      setLoading(false)
    }

    loadStats()
  }, [session, selectedDepartment])

  const getStatsTitle = () => {
    if (session?.user?.role === 'EMPLOYEE') {
      return '我的本月统计'
    }
    return selectedDepartment ? '部门本月统计' : '全公司本月统计'
  }

  const stats = [
    { name: '本月加班', value: loading ? '...' : `${overtimeHours} 小时`, icon: '⏰' },
    { name: '本月请假', value: loading ? '...' : `${leaveDays} 天`, icon: '📅' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">欢迎回来，{session?.user?.name}！</h1>
        <p className="text-gray-600 mt-1">
          角色：{session?.user?.role === 'ADMIN' ? '系统管理员' : session?.user?.role === 'MANAGER' ? '主管' : '员工'}
        </p>
      </div>

      {/* Department filter for admin/manager */}
      {session?.user?.role !== 'EMPLOYEE' && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">筛选部门：</span>
              <select
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">全部部门</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{getStatsTitle()}</h2>
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
                  <span className="font-medium text-blue-700">提交加班申请</span>
                </a>
                <a href="/dashboard/leave/new" className="block p-3 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                  <span className="font-medium text-green-700">提交请假申请</span>
                </a>
                <a href="/dashboard/performance/new" className="block p-3 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors">
                  <span className="font-medium text-purple-700">填写绩效</span>
                </a>
                <a href="/dashboard/compensatory" className="block p-3 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors">
                  <span className="font-medium text-orange-700">调休管理</span>
                </a>
              </>
            )}
            {(session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN') && (
              <a href="/dashboard/approvals" className="block p-3 bg-yellow-50 rounded-md hover:bg-yellow-100 transition-colors">
                <span className="font-medium text-yellow-700">处理审批</span>
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>日历</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>系统公告</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <p>欢迎使用劳务派遣员工管理系统</p>
              <p>请按时完成月度绩效填写</p>
              <p>加班申请需提前 1 天提交</p>
              <p>请假申请请确保假期余额充足</p>
              <p>月加班超过36小时部分自动转调休</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
