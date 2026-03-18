'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getPendingApprovals, approveApplication } from '@/server/actions/approval'

const statusVariant: Record<string, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const [pendingApps, setPendingApps] = useState({ overtime: [], leave: [] })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [remark, setRemark] = useState('')
  const [selectedApp, setSelectedApp] = useState<any>(null)

  const fetchPendingApprovals = async () => {
    const data = await getPendingApprovals(session?.user?.role)
    setPendingApps(data)
  }

  useEffect(() => {
    if (session && (session.user?.role === 'ADMIN' || session.user?.role === 'MANAGER')) {
      fetchPendingApprovals()
    }
  }, [session])

  const handleApprove = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedApp) return

    setLoading(true)
    setMessage({ type: '', text: '' })

    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7d0b3e',
      },
      body: JSON.stringify({
        sessionId: '7d0b3e',
        runId: 'pre-fix',
        hypothesisId: 'H0',
        location: 'src/app/(dashboard)/dashboard/approvals/page.tsx:handleApprove',
        message: 'Click approve/reject',
        data: {
          status,
          selectedApp: {
            id: selectedApp?.id,
            type: selectedApp?.type,
          },
          approverIdPresent: !!session?.user?.id,
          role: session?.user?.role,
          remarkLen: remark?.length ?? 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    const formData = new FormData()
    formData.set('applicationId', selectedApp.id)
    formData.set('applicationType', selectedApp.type)
    formData.set('status', status)
    formData.set('remark', remark)
    formData.set('approverId', session?.user?.id || '')

    const result = await approveApplication(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      setSelectedApp(null)
      setRemark('')
      fetchPendingApprovals()
    }

    setLoading(false)
  }

  if (session?.user?.role === 'EMPLOYEE') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">审批中心</h1>
          <p className="text-gray-600 mt-1">您没有权限访问此页面</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">审批中心</h1>
        <p className="text-gray-600 mt-1">处理待审批的加班和请假申请</p>
      </div>

      {selectedApp && (
        <Card>
          <CardHeader>
            <CardTitle>
              审批{selectedApp.type === 'OVERTIME' ? '加班' : '请假'}申请
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">申请人</Label>
                <div className="font-medium">{selectedApp.userName}</div>
              </div>
              {selectedApp.type === 'OVERTIME' ? (
                <>
                  <div>
                    <Label className="text-sm text-gray-600">加班日期</Label>
                    <div className="font-medium">
                      {new Date(selectedApp.date).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">时长</Label>
                    <div className="font-medium">{selectedApp.hours} 小时</div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-600">事由</Label>
                    <div className="font-medium">{selectedApp.reason}</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-sm text-gray-600">假期类型</Label>
                    <div className="font-medium">{selectedApp.leaveTypeText}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">开始日期</Label>
                    <div className="font-medium">
                      {new Date(selectedApp.startDate).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">结束日期</Label>
                    <div className="font-medium">
                      {new Date(selectedApp.endDate).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">天数</Label>
                    <div className="font-medium">{selectedApp.days} 天</div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-600">事由</Label>
                    <div className="font-medium">{selectedApp.reason}</div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remark">审批意见</Label>
              <Textarea
                id="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="请输入审批意见（可选）..."
                rows={3}
              />
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                onClick={() => handleApprove('APPROVED')}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                通过
              </Button>
              <Button
                onClick={() => handleApprove('REJECTED')}
                variant="destructive"
                disabled={loading}
              >
                拒绝
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedApp(null)
                  setRemark('')
                }}
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>待审批加班 ({pendingApps.overtime.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请人</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>时长</TableHead>
                  <TableHead>事由</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApps.overtime.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      暂无待审批加班
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingApps.overtime.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>{app.userName}</TableCell>
                      <TableCell>
                        {new Date(app.date).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>{app.hours}小时</TableCell>
                      <TableCell className="max-w-xs truncate">{app.reason}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => setSelectedApp({ ...app, type: 'OVERTIME' })}
                        >
                          审批
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>待审批请假 ({pendingApps.leave.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请人</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>天数</TableHead>
                  <TableHead>事由</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApps.leave.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      暂无待审批请假
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingApps.leave.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>{app.userName}</TableCell>
                      <TableCell>{app.leaveTypeText}</TableCell>
                      <TableCell>{app.days}天</TableCell>
                      <TableCell className="max-w-xs truncate">{app.reason}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => setSelectedApp({ ...app, type: 'LEAVE' })}
                        >
                          审批
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Label({ children, className, ...props }: any) {
  return (
    <label className={`block text-sm font-medium ${className}`} {...props}>
      {children}
    </label>
  )
}

