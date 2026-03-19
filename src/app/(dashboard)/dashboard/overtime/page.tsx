'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getOvertimeApplications } from '@/server/actions/overtime'

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

export default function OvertimePage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<any[]>([])

  const canCreate = !!session?.user?.id

  const fetchApplications = async () => {
    const data = await getOvertimeApplications(
      session?.user?.id,
      session?.user?.role
    )
    setApplications(data)

  }

  useEffect(() => {
    if (session) {
      fetchApplications()

    }
  }, [session])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">加班申请管理</h1>
          <p className="text-gray-600 mt-1">提交和查看加班申请记录</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/overtime/new">新增</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申请记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                {session?.user?.role !== 'EMPLOYEE' && <TableHead>申请人</TableHead>}
                <TableHead>时间</TableHead>
              <TableHead>时长 (小时)</TableHead>
              <TableHead>事由</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>备注</TableHead>
              {session?.user?.role === 'EMPLOYEE' && <TableHead>操作</TableHead>}
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
                    <TableCell>
                      {new Date(app.date).toLocaleDateString('zh-CN')}
                    </TableCell>
                    {session?.user?.role !== 'EMPLOYEE' && (
                      <TableCell>{app.userName}</TableCell>
                    )}
                    <TableCell>
                      {new Date(app.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(app.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>{app.hours}</TableCell>
                    <TableCell className="max-w-xs truncate">{app.reason}</TableCell>
                    <TableCell>{app.type === 'WEEKEND' ? '周末' : app.type === 'HOLIDAY' ? '节假日' : '工作日'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[app.status]}>
                        {statusMap[app.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{app.remark || '-'}</TableCell>
                    {session?.user?.role === 'EMPLOYEE' && (
                      <TableCell>
                        {app.status === 'DRAFT' ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/overtime/${app.id}`}>编辑</Link>
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
