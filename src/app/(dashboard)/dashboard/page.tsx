'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { getOvertimeStats } from '@/server/actions/overtime'
import { getLeaveStats } from '@/server/actions/leave'
import { getDepartments } from '@/server/actions/department'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [overtimeHours, setOvertimeHours] = useState(0)
  const [leaveDays, setLeaveDays] = useState(0)
  const [statsMonthLabel, setStatsMonthLabel] = useState('本月')
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      if (!session?.user) {
        return
      }

      setLoading(true)

      const isEmployee = session.user.role === 'EMPLOYEE'
      const userId = isEmployee ? session.user.id : undefined
      const departmentId = !isEmployee && selectedDepartment ? selectedDepartment : undefined
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`

      const [currentHours, currentDays, deptList] = await Promise.all([
        getOvertimeStats(userId, departmentId, currentMonth),
        getLeaveStats(userId, departmentId, currentMonth),
        isEmployee ? Promise.resolve([]) : getDepartments(),
      ])

      if (currentHours === 0 && currentDays === 0) {
        const [previousHours, previousDays] = await Promise.all([
          getOvertimeStats(userId, departmentId, previousMonth),
          getLeaveStats(userId, departmentId, previousMonth),
        ])

        setOvertimeHours(previousHours)
        setLeaveDays(previousDays)
        setStatsMonthLabel(previousHours === 0 && previousDays === 0 ? '本月' : '上月')
      } else {
        setOvertimeHours(currentHours)
        setLeaveDays(currentDays)
        setStatsMonthLabel('本月')
      }

      setDepartments(deptList)
      setLoading(false)
    }

    loadStats()
  }, [selectedDepartment, session])

  const roleLabel =
    session?.user?.role === 'ADMIN'
      ? '系统管理员'
      : session?.user?.role === 'MANAGER'
      ? '部门主管'
      : '员工'

  const departmentName = useMemo(
    () => departments.find((department) => department.id === selectedDepartment)?.name || '全部部门',
    [departments, selectedDepartment]
  )

  const stats = [
    {
      name: `${statsMonthLabel}加班`,
      value: loading ? '...' : `${overtimeHours} 小时`,
      hint: '已审批通过的有效时长',
      accent: 'from-sky-500/15 to-sky-500/5 text-sky-700',
    },
    {
      name: `${statsMonthLabel}请假`,
      value: loading ? '...' : `${leaveDays} 天`,
      hint: '已纳入统计的请假天数',
      accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700',
    },
  ]

  const quickActions = [
    ...(session?.user?.role === 'EMPLOYEE'
      ? [
          {
            title: '发起加班申请',
            description: '快速提交加班记录并进入审批流程。',
            href: '/dashboard/overtime/new',
            style: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
          },
          {
            title: '提交请假申请',
            description: '按假期类型填写申请并查看余额。',
            href: '/dashboard/leave/new',
            style: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
          },
          {
            title: '填写绩效记录',
            description: '补充本期绩效和自评内容。',
            href: '/dashboard/performance/new',
            style: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
          },
        ]
      : []),
    ...((session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN')
      ? [
          {
            title: '处理审批待办',
            description: '查看当前轮到你的审批事项。',
            href: '/dashboard/approvals',
            style: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
          },
        ]
      : []),
  ]

  const overviewTitle =
    session?.user?.role === 'EMPLOYEE' ? `我的${statsMonthLabel}概览` : `${departmentName}${statsMonthLabel}概览`

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.7fr,1fr]">
        <Card className="overflow-hidden border border-sky-100 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(238,246,255,0.95))] shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <Badge className="border border-sky-200 bg-sky-50 text-sky-700">
                  {roleLabel}
                </Badge>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    欢迎回来，{session?.user?.name || '同事'}
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">
                    今天是 {formatDate(new Date())}。你当前查看的是
                    {session?.user?.role === 'EMPLOYEE' ? '个人工作台' : departmentName}
                    的业务概览，常用操作和关键数据都放在这里。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="bg-slate-950 text-white hover:bg-slate-800">
                    <Link href="/dashboard/overtime">查看加班记录</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <Link href="/dashboard/profile">维护个人信息</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:min-w-[280px] sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                {stats.map((stat) => (
                  <div
                    key={stat.name}
                    className={`rounded-3xl border border-white/70 bg-gradient-to-br p-5 ${stat.accent}`}
                  >
                    <div className="text-sm font-medium text-slate-700">{stat.name}</div>
                    <div className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</div>
                    <div className="mt-2 text-xs text-slate-600">{stat.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/80 shadow-lg backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle>{overviewTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {session?.user?.role !== 'EMPLOYEE' && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">部门筛选</div>
                <Select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
                  <option value="">全部部门</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">当前统计范围</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{statsMonthLabel}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {session?.user?.role === 'EMPLOYEE' ? '展示你的个人统计结果' : `当前选择：${departmentName}`}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">工作提醒</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">记录更集中</div>
                <div className="mt-1 text-sm text-slate-600">
                  仪表盘已把常用入口、统计和日历集中到同一屏。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {quickActions.length > 0 ? (
              quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`rounded-3xl p-5 transition-colors ${action.style}`}
                >
                  <div className="text-lg font-semibold">{action.title}</div>
                  <div className="mt-2 text-sm leading-6 opacity-90">{action.description}</div>
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                当前角色暂时没有快捷操作入口，请从左侧菜单进入对应模块。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle>日历</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Calendar />
          </CardContent>
        </Card>
      </section>

      <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>系统提醒</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              '请按时补充绩效记录，避免月底集中填写。',
              '加班申请建议提前发起，便于审批节点按时流转。',
              '请假前先确认假期余额和排班安排。',
              '月度工时超额部分会按系统规则转入调休或薪资结算。',
            ].map((notice) => (
              <div
                key={notice}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"
              >
                {notice}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
