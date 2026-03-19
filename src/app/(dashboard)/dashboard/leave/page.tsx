'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getLeaveApplications, getLeaveBalances } from '@/server/actions/leave'
import { getCompensatorySourceHistory } from '@/server/actions/compensatory'
import { formatDate, formatDateTime } from '@/lib/utils'

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已退回',
  COMPLETED: '已完成',
}

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
}

export default function LeavePage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<any[]>([])
  const [balances, setBalances] = useState<any>(null)
  const [sourceHistory, setSourceHistory] = useState<any[]>([])

  const canCreate = !!session?.user?.id
  const canEdit = session?.user?.role === 'EMPLOYEE'

  const fetchApplications = async () => {
    const data = await getLeaveApplications(session?.user?.id, session?.user?.role)
    setApplications(data)
  }

  const fetchBalances = async () => {
    if (session?.user?.id) {
      const [balance, sources] = await Promise.all([
        getLeaveBalances(session.user.id),
        getCompensatorySourceHistory(session.user.id),
      ])
      setBalances(balance)
      setSourceHistory(sources)
    }
  }

  useEffect(() => {
    if (session) {
      fetchApplications()
      fetchBalances()
    }
  }, [session])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">请假管理</h1>
          <p className="text-gray-600 mt-1">调休作为一种假种统一在此申请，并共用请假审批流程</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/leave/new">新增申请</Link>
          </Button>
        )}
      </div>

      {balances && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>假期余额 ({new Date().getFullYear()}年)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">年假</div>
                <div className="text-2xl font-bold text-blue-700">{balances.annual} 天</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">病假</div>
                <div className="text-2xl font-bold text-green-700">{balances.sick} 天</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-sm text-gray-600">事假</div>
                <div className="text-2xl font-bold text-yellow-700">{balances.personal} 天</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600">调休可用</div>
                <div className="text-2xl font-bold text-orange-700">
                  {(balances.compensatory || 0) - (balances.usedCompensatory || 0)} 小时
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  累计 {(balances.compensatory || 0)} 小时 / 已使用 {(balances.usedCompensatory || 0)} 小时
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>调休来源记录</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceHistory.length === 0 ? (
              <div className="text-sm text-gray-500">暂无调休来源记录</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>加班日期</TableHead>
                    <TableHead>加班类型</TableHead>
                    <TableHead>转调休时长</TableHead>
                    <TableHead>薪资月份</TableHead>
                    <TableHead>创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(new Date(item.date))}</TableCell>
                      <TableCell>
                        {item.overtimeType === 'WORKDAY'
                          ? '工作日'
                          : item.overtimeType === 'WEEKEND'
                          ? '周末'
                          : '节假日'}
                      </TableCell>
                      <TableCell>{item.hours} 小时</TableCell>
                      <TableCell>{item.salaryMonth || '-'}</TableCell>
                      <TableCell>{formatDateTime(new Date(item.createdAt))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>申请记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                {session?.user?.role !== 'EMPLOYEE' && <TableHead>申请人</TableHead>}
                <TableHead>开始日期</TableHead>
                <TableHead>结束日期</TableHead>
                <TableHead>天数</TableHead>
                <TableHead>调休时长</TableHead>
                <TableHead>事由</TableHead>
                <TableHead>前往地点</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
                {canEdit && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                    暂无申请记录
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>{app.leaveTypeText}</TableCell>
                    {session?.user?.role !== 'EMPLOYEE' && <TableCell>{app.userName}</TableCell>}
                    <TableCell>{new Date(app.startDate).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>{new Date(app.endDate).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>{app.days}</TableCell>
                    <TableCell>{app.type === 'COMPENSATORY' ? `${app.compensatoryHours} 小时` : '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{app.reason}</TableCell>
                    <TableCell>{app.destination || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[app.status] || 'default'}>
                        {statusMap[app.status] || app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{app.remark || '-'}</TableCell>
                    {canEdit && (
                      <TableCell>
                        {app.status === 'DRAFT' ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/leave/${app.id}`}>编辑</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">审批中/已完成</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
