'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { createOvertimeApplication, getOvertimeApplications } from '@/server/actions/overtime'

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
  const [showForm, setShowForm] = useState(false)
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    formData.set('userId', session?.user?.id || '')

    const result = await createOvertimeApplication(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      setShowForm(false)
      fetchApplications()
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">加班申请管理</h1>
          <p className="text-gray-600 mt-1">提交和查看加班申请记录</p>
        </div>
        {session?.user?.role === 'EMPLOYEE' && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? '返回列表' : '提交申请'}
          </Button>
        )}
      </div>

      {showForm && session?.user?.role === 'EMPLOYEE' && (
        <Card>
          <CardHeader>
            <CardTitle>提交加班申请</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">加班日期</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>时间范围</Label>
                  <div className="flex space-x-2">
                    <Input
                      name="startTime"
                      type="time"
                      required
                      className="flex-1"
                    />
                    <span className="text-gray-400">至</span>
                    <Input
                      name="endTime"
                      type="time"
                      required
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">加班事由</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="请详细描述加班工作内容..."
                  rows={4}
                  required
                />
              </div>
              {message.text && (
                <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {message.text}
                </div>
              )}
              <div className="flex space-x-2">
                <Button type="submit" disabled={loading}>
                  {loading ? '提交中...' : '提交申请'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  取消
                </Button>
              </div>
            </form>
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
                <TableHead>日期</TableHead>
                {session?.user?.role !== 'EMPLOYEE' && <TableHead>申请人</TableHead>}
                <TableHead>时间</TableHead>
                <TableHead>时长 (小时)</TableHead>
                <TableHead>事由</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
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
                    <TableCell>
                      <Badge variant={statusVariant[app.status]}>
                        {statusMap[app.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{app.remark || '-'}</TableCell>
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
