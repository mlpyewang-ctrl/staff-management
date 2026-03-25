'use client'

import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PaginationControls } from '@/components/ui/pagination-controls'
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
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  getPaginationState,
} from '@/lib/pagination'
import { TimeRange, isWithinTimeRange, timeRangeOptions } from '@/lib/time-range'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  approveApplication,
  getApprovalHistory,
  getPendingApprovals,
} from '@/server/actions/approval'
import type { Role } from '@/types'

type PendingApprovalsData = Awaited<ReturnType<typeof getPendingApprovals>>
type ApprovalHistoryData = Awaited<ReturnType<typeof getApprovalHistory>>
type PendingOvertimeApproval = PendingApprovalsData['overtime'][number]
type PendingLeaveApproval = PendingApprovalsData['leave'][number]
type ApprovalHistoryItem = ApprovalHistoryData[number]
type SelectedApproval =
  | (PendingOvertimeApproval & { type: 'OVERTIME' })
  | (PendingLeaveApproval & { type: 'LEAVE' })

interface ApprovalsClientPageProps {
  initialHistory: ApprovalHistoryData
  initialPendingApps: PendingApprovalsData
  viewerRole: Role
}

export function ApprovalsClientPage({
  initialHistory,
  initialPendingApps,
  viewerRole,
}: ApprovalsClientPageProps) {
  const [pendingApps, setPendingApps] = useState(initialPendingApps)
  const [history, setHistory] = useState(initialHistory)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [remark, setRemark] = useState('')
  const [selectedApp, setSelectedApp] = useState<SelectedApproval | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [overtimePage, setOvertimePage] = useState(1)
  const [leavePage, setLeavePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [overtimePageSize, setOvertimePageSize] = useState(DEFAULT_PAGE_SIZE)
  const [leavePageSize, setLeavePageSize] = useState(DEFAULT_PAGE_SIZE)
  const [historyPageSize, setHistoryPageSize] = useState(DEFAULT_PAGE_SIZE)

  useEffect(() => {
    setPendingApps(initialPendingApps)
  }, [initialPendingApps])

  useEffect(() => {
    setHistory(initialHistory)
  }, [initialHistory])

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

  const overtimePagination = useMemo(
    () => getPaginationState(filteredPendingOvertime.length, overtimePage, overtimePageSize),
    [filteredPendingOvertime.length, overtimePage, overtimePageSize]
  )
  const leavePagination = useMemo(
    () => getPaginationState(filteredPendingLeave.length, leavePage, leavePageSize),
    [filteredPendingLeave.length, leavePage, leavePageSize]
  )
  const historyPagination = useMemo(
    () => getPaginationState(filteredHistory.length, historyPage, historyPageSize),
    [filteredHistory.length, historyPage, historyPageSize]
  )

  const paginatedPendingOvertime = useMemo(
    () => filteredPendingOvertime.slice(overtimePagination.startIndex, overtimePagination.endIndex),
    [filteredPendingOvertime, overtimePagination.endIndex, overtimePagination.startIndex]
  )
  const paginatedPendingLeave = useMemo(
    () => filteredPendingLeave.slice(leavePagination.startIndex, leavePagination.endIndex),
    [filteredPendingLeave, leavePagination.endIndex, leavePagination.startIndex]
  )
  const paginatedHistory = useMemo(
    () => filteredHistory.slice(historyPagination.startIndex, historyPagination.endIndex),
    [filteredHistory, historyPagination.endIndex, historyPagination.startIndex]
  )

  useEffect(() => {
    setOvertimePage(1)
    setLeavePage(1)
    setHistoryPage(1)
  }, [historyPageSize, leavePageSize, overtimePageSize, timeRange])

  useEffect(() => {
    if (overtimePagination.currentPage !== overtimePage) {
      setOvertimePage(overtimePagination.currentPage)
    }
  }, [overtimePage, overtimePagination.currentPage])

  useEffect(() => {
    if (leavePagination.currentPage !== leavePage) {
      setLeavePage(leavePagination.currentPage)
    }
  }, [leavePage, leavePagination.currentPage])

  useEffect(() => {
    if (historyPagination.currentPage !== historyPage) {
      setHistoryPage(historyPagination.currentPage)
    }
  }, [historyPage, historyPagination.currentPage])

  const refreshApprovals = async () => {
    const [nextPendingApps, nextHistory] = await Promise.all([getPendingApprovals(), getApprovalHistory()])
    setPendingApps(nextPendingApps)
    setHistory(nextHistory)
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

  if (viewerRole === 'EMPLOYEE') {
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
          <p className="mt-2 text-sm text-slate-600">处理待办审批，并按时间范围筛选待办和历史记录。</p>
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
              <div className="py-8 text-center text-slate-500">当前筛选条件下暂无待审批加班</div>
            ) : (
              <div className="space-y-4">
                {paginatedPendingOvertime.map((application) => (
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
                    onApprove={() => setSelectedApp({ ...application, type: 'OVERTIME' })}
                  />
                ))}
              </div>
            )}
            <PaginationControls
              className="mt-4"
              currentPage={overtimePagination.currentPage}
              itemLabel="条待审批记录"
              onPageChange={setOvertimePage}
              onPageSizeChange={setOvertimePageSize}
              pageSize={overtimePageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={filteredPendingOvertime.length}
              totalPages={overtimePagination.totalPages}
            />
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle>待审批请假（{filteredPendingLeave.length}）</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPendingLeave.length === 0 ? (
              <div className="py-8 text-center text-slate-500">当前筛选条件下暂无待审批请假</div>
            ) : (
              <div className="space-y-4">
                {paginatedPendingLeave.map((application) => (
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
                    onApprove={() => setSelectedApp({ ...application, type: 'LEAVE' })}
                  />
                ))}
              </div>
            )}
            <PaginationControls
              className="mt-4"
              currentPage={leavePagination.currentPage}
              itemLabel="条待审批记录"
              onPageChange={setLeavePage}
              onPageSizeChange={setLeavePageSize}
              pageSize={leavePageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={filteredPendingLeave.length}
              totalPages={leavePagination.totalPages}
            />
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
                paginatedHistory.map((item) => (
                  <ApprovalHistoryRow key={item.id} item={item} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardContent className="pt-0">
          <PaginationControls
            currentPage={historyPagination.currentPage}
            itemLabel="条审批记录"
            onPageChange={setHistoryPage}
            onPageSizeChange={setHistoryPageSize}
            pageSize={historyPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={filteredHistory.length}
            totalPages={historyPagination.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ApprovalHistoryRow({ item }: { item: ApprovalHistoryItem }) {
  return (
    <TableRow>
      <TableCell>{item.applicationTypeText}</TableCell>
      <TableCell>{item.applicantName}</TableCell>
      <TableCell>
        <Badge variant={item.status === 'APPROVED' ? 'success' : 'danger'}>{item.statusText}</Badge>
      </TableCell>
      <TableCell className="max-w-xs truncate">{item.remark || '-'}</TableCell>
      <TableCell>{formatDateTime(new Date(item.createdAt))}</TableCell>
    </TableRow>
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
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</div>
                <div className="mt-2 text-sm font-medium text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-white px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">事由</div>
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
