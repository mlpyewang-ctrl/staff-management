'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select } from '@/components/ui/select'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  getPaginationState,
} from '@/lib/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TimeRange, isWithinTimeRange, timeRangeOptions } from '@/lib/time-range'
import { getOvertimeApplications } from '@/server/actions/overtime'

type OvertimeApplicationItem = Awaited<ReturnType<typeof getOvertimeApplications>>[number]

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
  const [applications, setApplications] = useState<OvertimeApplicationItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')

  const canCreate = !!session?.user?.id
  const showApplicant = session?.user?.role !== 'EMPLOYEE'
  const showActions = session?.user?.role === 'EMPLOYEE'

  useEffect(() => {
    const fetchApplications = async () => {
      const data = await getOvertimeApplications(session?.user?.id, session?.user?.role)
      setApplications(data)
    }

    if (session) {
      fetchApplications()
    }
  }, [session])

  const filteredApplications = useMemo(
    () => applications.filter((application) => isWithinTimeRange(application.date, timeRange)),
    [applications, timeRange]
  )
  const pagination = useMemo(
    () => getPaginationState(filteredApplications.length, currentPage, pageSize),
    [currentPage, filteredApplications.length, pageSize]
  )
  const paginatedApplications = useMemo(
    () => filteredApplications.slice(pagination.startIndex, pagination.endIndex),
    [filteredApplications, pagination.endIndex, pagination.startIndex]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [timeRange, pageSize])

  useEffect(() => {
    if (pagination.currentPage !== currentPage) {
      setCurrentPage(pagination.currentPage)
    }
  }, [currentPage, pagination.currentPage])

  const emptyColSpan = 7 + (showApplicant ? 1 : 0) + (showActions ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">加班申请管理</h1>
          <p className="mt-2 text-sm text-slate-600">
            统一查看申请进度，并按时间范围快速筛选记录。
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/overtime/new">新增加班申请</Link>
          </Button>
        )}
      </div>

      <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>申请记录</CardTitle>
            <div className="mt-2 text-sm text-slate-500">当前共 {filteredApplications.length} 条记录</div>
          </div>
          <div className="w-full sm:w-52">
            <Select value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRange)}>
              {timeRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                {showApplicant && <TableHead>申请人</TableHead>}
                <TableHead>时间段</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>事由</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
                {showActions && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={emptyColSpan} className="py-8 text-center text-slate-500">
                    当前筛选条件下暂无加班记录
                  </TableCell>
                </TableRow>
              ) : (
                paginatedApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>{new Date(application.date).toLocaleDateString('zh-CN')}</TableCell>
                    {showApplicant && <TableCell>{application.userName}</TableCell>}
                    <TableCell>
                      {new Date(application.startTime).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {new Date(application.endTime).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{application.hours} 小时</TableCell>
                    <TableCell className="max-w-xs truncate">{application.reason}</TableCell>
                    <TableCell>
                      {application.type === 'WEEKEND' ? '周末' : application.type === 'HOLIDAY' ? '节假日' : '工作日'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[application.status]}>{statusMap[application.status]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{application.remark || '-'}</TableCell>
                    {showActions && (
                      <TableCell>
                        {application.status === 'DRAFT' ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/overtime/${application.id}`}>编辑</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">审批中或已完成</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardContent className="pt-0">
          <PaginationControls
            currentPage={pagination.currentPage}
            itemLabel="条记录"
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={filteredApplications.length}
            totalPages={pagination.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}
