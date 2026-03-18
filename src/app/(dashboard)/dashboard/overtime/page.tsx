'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createOvertimeApplication, getOvertimeApplications, updateOvertimeApplication } from '@/server/actions/overtime'

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

export default function OvertimePage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const canCreate = !!session?.user?.id
  const canEdit = !!session?.user?.id

  const fetchApplications = async () => {
    const data = await getOvertimeApplications(
      session?.user?.id,
      session?.user?.role
    )
    setApplications(data)

    // #region agent log
    fetch('http://127.0.0.1:7411/ingest/a123eedd-0d9e-424e-b565-89bc816ab6ab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '21ada3',
      },
      body: JSON.stringify({
        sessionId: '21ada3',
        runId: 'nav-debug',
        hypothesisId: 'H-buttons',
        location: 'src/app/(dashboard)/dashboard/overtime/page.tsx:39',
        message: 'overtime page loaded',
        data: {
          role: session?.user?.role ?? null,
          appCount: data.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
  }

  useEffect(() => {
    if (session) {
      fetchApplications()

      // #region agent log
      fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '00641c',
        },
        body: JSON.stringify({
          sessionId: '00641c',
          runId: 'pre-fix',
          hypothesisId: 'B2',
          location: 'src/app/(dashboard)/dashboard/overtime/page.tsx:useEffect',
          message: 'Overtime page session ready',
          data: {
            role: session?.user?.role ?? null,
            canCreate,
            canEdit,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
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
              {canEdit && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
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
                    {canEdit && (
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/overtime/${app.id}`}>编辑</Link>
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
