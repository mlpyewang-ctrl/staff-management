'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { TimeRange, isWithinTimeRange, timeRangeOptions } from '@/lib/time-range'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  approveApplication,
  getApprovalHistory,
  getPendingApprovals,
} from '@/server/actions/approval'

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const [pendingApps, setPendingApps] = useState<{ overtime: any[]; leave: any[] }>({
    overtime: [],
    leave: [],
  })
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [remark, setRemark] = useState('')
  const [selectedApp, setSelectedApp] = useState<any>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')

  useEffect(() => {
    const fetchPendingApprovals = async () => {
      const [pendingData, historyData] = await Promise.all([
        getPendingApprovals(session?.user?.id),
        getApprovalHistory(session?.user?.id),
      ])
      setPendingApps(pendingData)
      setHistory(historyData)
    }

    if (session && (session.user?.role === 'ADMIN' || session.user?.role === 'MANAGER')) {
      fetchPendingApprovals()
    }
  }, [session])

  const filteredPendingOvertime = useMemo(
    () => pendingApps.overtime.filter((application) => isWithinTimeRange(application.date, timeRange)),
    [pendingApps.overtime, timeRange]
  )

  const filteredPendingLeave = useMemo(
    () => pendingApps.leave.filter((application) => isWithinTimeRange(application.startDate, timeRange)),
    [pendingApps.leave, timeRange]
  )

  const filteredHistory = useMemo(
    () => history.filter((item) => isWithinTimeRange(item.createdAt, timeRange)),
    [history, timeRange]
  )

  const refreshApprovals = async () => {
    const [pendingData, historyData] = await Promise.all([
      getPendingApprovals(session?.user?.id),
      getApprovalHistory(session?.user?.id),
    ])
    setPendingApps(pendingData)
    setHistory(historyData)
  }

  const handleApprove = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedApp) {
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

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
      await refreshApprovals()
    }

    setLoading(false)
  }

  if (session?.user?.role === 'EMPLOYEE') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">审批中心</h1>
          <p className="mt-2 text-sm text-slate-600">当前账号没有访问审批中心的权限。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">审批中心</h1>
          <p className="mt-2 text-sm text-slate-600">
            处理待办审批，并按时间范围筛选待办和历史记录。
          </p>
        </div>
        <div className="w-full lg:w-52">
          <Select value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRange)}>
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {selectedApp && (
        <Card className="border-white/70 bg-white/90 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle>审批{selectedApp.type === 'OVERTIME' ? '加班' : '请假'}申请</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="申请人" value={selectedApp.userName} />
              <DetailItem label="当前审批节点" value={selectedApp.currentStepName} />
              <DetailItem label="审批进度" value={selectedApp.approvalProgress} />
              {selectedApp.type === 'OVERTIME' ? (
                <>
                  <DetailItem label="加班日期" value={formatDate(new Date(selectedApp.date))} />
                  <DetailItem label="时长" value={`${selectedApp.hours} 小时`} />
                  <div className="md:col-span-2">
                    <DetailItem label="事由" value={selectedApp.reason} />
                  </div>
                </>
              ) : (
                <>
                  <DetailItem label="假期类型" value={selectedApp.leaveTypeText} />
                  <DetailItem label="开始日期" value={formatDate(new Date(selectedApp.startDate))} />
                  <DetailItem label="结束日期" value={formatDate(new Date(selectedApp.endDate))} />
                  <DetailItem label="天数" value={`${selectedApp.days} 天`} />
                  <div className="md:col-span-2">
                    <DetailItem label="事由" value={selectedApp.reason} />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remark">审批意见</Label>
              <Textarea
                id="remark"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="请输入审批意见（可选）"
                rows={3}
              />
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleApprove('APPROVED')}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                通过
              </Button>
              <Button onClick={() => handleApprove('REJECTED')} variant="destructive" disabled={loading}>
                退回
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedApp(null)
                  setRemark('')
                  setMessage({ type: '', text: '' })
                }}
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle>待审批加班（{filteredPendingOvertime.length}）</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPendingOvertime.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                当前筛选条件下暂无待审批加班
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPendingOvertime.map((application) => (
                  <PendingApprovalCard
                    key={application.id}
                    title={application.userName}
                    meta={[
                      { label: '日期', value: formatDate(new Date(application.date)) },
                      { label: '时长', value: `${application.hours} 小时` },
                      { label: '审批节点', value: application.currentStepName },
                      { label: '进度', value: application.approvalProgress },
                    ]}
                    reason={application.reason}
                    onApprove={() =>
                      setSelectedApp({ ...application, type: 'OVERTIME' })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle>待审批请假（{filteredPendingLeave.length}）</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPendingLeave.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                当前筛选条件下暂无待审批请假
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPendingLeave.map((application) => (
                  <PendingApprovalCard
                    key={application.id}
                    title={application.userName}
                    meta={[
                      { label: '类型', value: application.leaveTypeText },
                      { label: '天数', value: `${application.days} 天` },
                      { label: '审批节点', value: application.currentStepName },
                      { label: '进度', value: application.approvalProgress },
                    ]}
                    reason={application.reason}
                    onApprove={() =>
                      setSelectedApp({ ...application, type: 'LEAVE' })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>我的审批记录（{filteredHistory.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>申请类型</TableHead>
                <TableHead>申请人</TableHead>
                <TableHead>审批结果</TableHead>
                <TableHead>审批意见</TableHead>
                <TableHead>审批时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                    当前筛选条件下暂无审批记录
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.applicationTypeText}</TableCell>
                    <TableCell>{item.applicantName}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'APPROVED' ? 'success' : 'danger'}>{item.statusText}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{item.remark || '-'}</TableCell>
                    <TableCell>{formatDateTime(new Date(item.createdAt))}</TableCell>
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-base font-medium text-slate-900">{value}</div>
    </div>
  )
}

function PendingApprovalCard({
  title,
  meta,
  reason,
  onApprove,
}: {
  title: string
  meta: Array<{ label: string; value: string }>
  reason: string
  onApprove: () => void
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {meta.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {item.label}
                </div>
                <div className="mt-2 text-sm font-medium text-slate-800">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-white px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              事由
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-700">{reason}</div>
          </div>
        </div>

        <div className="xl:pl-4">
          <Button size="sm" onClick={onApprove}>
            审批
          </Button>
        </div>
      </div>
    </div>
  )
}

function Label({ children, className, ...props }: any) {
  return (
    <label className={`block text-sm font-medium ${className || ''}`} {...props}>
      {children}
    </label>
  )
}
