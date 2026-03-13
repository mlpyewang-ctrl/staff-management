'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createLeaveApplication, getLeaveApplications, getLeaveBalances } from '@/server/actions/leave'

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
  const [showForm, setShowForm] = useState(false)
  const [applications, setApplications] = useState<any[]>([])
  const [balances, setBalances] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    formData.set('userId', session?.user?.id || '')

    const result = await createLeaveApplication(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      setShowForm(false)
      fetchApplications()
      fetchBalances()
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">请假管理</h1>
          <p className="text-gray-600 mt-1">提交和查看请假申请记录</p>
        </div>
        {session?.user?.role === 'EMPLOYEE' && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? '返回列表' : '提交申请'}
          </Button>
        )}
      </div>

      {balances && session?.user?.role === 'EMPLOYEE' && (
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

      {showForm && session?.user?.role === 'EMPLOYEE' && (
        <Card>
          <CardHeader>
            <CardTitle>提交请假申请</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">假期类型</Label>
                  <Select id="type" name="type" required>
                    <option value="ANNUAL">年假</option>
                    <option value="SICK">病假</option>
                    <option value="PERSONAL">事假</option>
                    <option value="MARRIAGE">婚假</option>
                    <option value="MATERNITY">产假</option>
                    <option value="PATERNITY">陪产假</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>请假时间</Label>
                  <div className="flex space-x-2">
                    <Input
                      name="startDate"
                      type="date"
                      required
                      className="flex-1"
                    />
                    <span className="text-gray-400">至</span>
                    <Input
                      name="endDate"
                      type="date"
                      required
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">请假事由</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="请详细描述请假原因..."
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
                <TableHead>类型</TableHead>
                {session?.user?.role !== 'EMPLOYEE' && <TableHead>申请人</TableHead>}
                <TableHead>开始日期</TableHead>
                <TableHead>结束日期</TableHead>
                <TableHead>天数</TableHead>
                <TableHead>事由</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
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
