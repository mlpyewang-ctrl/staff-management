'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getLeaveApplications, getLeaveBalances } from '@/server/actions/leave'

const statusMap: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
}

const statusVariant: Record<string, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
}

export default function LeavePage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<any[]>([])
  const [balances, setBalances] = useState<any>(null)

  const canCreate = !!session?.user?.id
  const canEdit = !!session?.user?.id

  const fetchApplications = async () => {
    const data = await getLeaveApplications(
      session?.user?.id,
      session?.user?.role
    )
    setApplications(data)
  }

  const fetchBalances = async () => {
    if (session?.user?.id) {
      const balance = await getLeaveBalances(session.user.id)
      setBalances(balance)
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
          <p className="text-gray-600 mt-1">提交和查看请假申请记录</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/leave/new">新增</Link>
          </Button>
        )}
      </div>

      {balances && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>假期余额 ({new Date().getFullYear()}年)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
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
            </div>
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
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    暂无申请记录
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>{app.leaveTypeText}</TableCell>
                    {session?.user?.role !== 'EMPLOYEE' && (
                      <TableCell>{app.userName}</TableCell>
                    )}
                    <TableCell>
                      {new Date(app.startDate).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      {new Date(app.endDate).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>{app.days}</TableCell>
                    <TableCell className="max-w-xs truncate">{app.reason}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[app.status]}>
                        {statusMap[app.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{app.remark || '-'}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/leave/${app.id}`}>编辑</Link>
                        </Button>
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

