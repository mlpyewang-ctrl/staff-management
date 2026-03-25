'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, getPaginationState } from '@/lib/pagination'
import { getCompensatorySourceHistory } from '@/server/actions/compensatory'
import { getLeaveApplications, getLeaveBalances } from '@/server/actions/leave'
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

function getSessionText(session?: string | null) {
  if (session === 'AM') {
    return '上午'
  }

  if (session === 'PM') {
    return '下午'
  }

  return '-'
}

export default function LeavePage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<any[]>([])
  const [balances, setBalances] = useState<any>(null)
  const [sourceHistory, setSourceHistory] = useState<any[]>([])
  const [applicationPage, setApplicationPage] = useState(1)
  const [applicationPageSize, setApplicationPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sourcePage, setSourcePage] = useState(1)
  const [sourcePageSize, setSourcePageSize] = useState(DEFAULT_PAGE_SIZE)

  const canCreate = !!session?.user?.id
  const canEdit = session?.user?.role === 'EMPLOYEE'

  const fetchApplications = async () => {
    const data = await getLeaveApplications(session?.user?.id, session?.user?.role)
    setApplications(data)
  }

  const fetchBalances = async () => {
    if (!session?.user?.id) {
      return
    }

    const [balance, sources] = await Promise.all([
      getLeaveBalances(session.user.id),
      getCompensatorySourceHistory(session.user.id),
    ])
    setBalances(balance)
    setSourceHistory(sources)
  }

  useEffect(() => {
    if (session) {
      fetchApplications()
      fetchBalances()
    }
  }, [session])

  const sourcePagination = useMemo(
    () => getPaginationState(sourceHistory.length, sourcePage, sourcePageSize),
    [sourceHistory.length, sourcePage, sourcePageSize]
  )
  const applicationPagination = useMemo(
    () => getPaginationState(applications.length, applicationPage, applicationPageSize),
    [applicationPage, applicationPageSize, applications.length]
  )
  const paginatedSourceHistory = useMemo(
    () => sourceHistory.slice(sourcePagination.startIndex, sourcePagination.endIndex),
    [sourceHistory, sourcePagination.endIndex, sourcePagination.startIndex]
  )
  const paginatedApplications = useMemo(
    () => applications.slice(applicationPagination.startIndex, applicationPagination.endIndex),
    [applicationPagination.endIndex, applicationPagination.startIndex, applications]
  )

  useEffect(() => {
    setSourcePage(1)
  }, [sourcePageSize])

  useEffect(() => {
    setApplicationPage(1)
  }, [applicationPageSize])

  useEffect(() => {
    if (sourcePagination.currentPage !== sourcePage) {
      setSourcePage(sourcePagination.currentPage)
    }
  }, [sourcePage, sourcePagination.currentPage])

  useEffect(() => {
    if (applicationPagination.currentPage !== applicationPage) {
      setApplicationPage(applicationPagination.currentPage)
    }
  }, [applicationPage, applicationPagination.currentPage])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">请假管理</h1>
          <p className="mt-1 text-gray-600">调休作为一种假种统一在此申请，并共用请假审批流程。</p>
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
            <CardTitle>假期余额（{new Date().getFullYear()}年）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-sm text-gray-600">年假</div>
                <div className="text-2xl font-bold text-blue-700">{balances.annual} 天</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <div className="text-sm text-gray-600">病假</div>
                <div className="text-2xl font-bold text-green-700">{balances.sick} 天</div>
              </div>
              <div className="rounded-lg bg-yellow-50 p-4">
                <div className="text-sm text-gray-600">事假</div>
                <div className="text-2xl font-bold text-yellow-700">{balances.personal} 天</div>
              </div>
              <div className="rounded-lg bg-orange-50 p-4">
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
                  {paginatedSourceHistory.map((item) => (
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
          <CardContent className="pt-0">
            <PaginationControls
              currentPage={sourcePagination.currentPage}
              itemLabel="条来源记录"
              onPageChange={setSourcePage}
              onPageSizeChange={setSourcePageSize}
              pageSize={sourcePageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={sourceHistory.length}
              totalPages={sourcePagination.totalPages}
            />
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
                <TableHead>开始/结束时段</TableHead>
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
                  <TableCell colSpan={12} className="py-8 text-center text-gray-500">
                    暂无申请记录
                  </TableCell>
                </TableRow>
              ) : (
                paginatedApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>{app.leaveTypeText}</TableCell>
                    {session?.user?.role !== 'EMPLOYEE' && <TableCell>{app.userName}</TableCell>}
                    <TableCell>{new Date(app.startDate).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>{new Date(app.endDate).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>
                      {getSessionText(app.startSession || app.halfDaySession)} →{' '}
                      {getSessionText(app.endSession || app.halfDaySession)}
                    </TableCell>
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
                          <span className="text-xs text-gray-400">审批中 / 已完成</span>
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
            currentPage={applicationPagination.currentPage}
            itemLabel="条申请记录"
            onPageChange={setApplicationPage}
            onPageSizeChange={setApplicationPageSize}
            pageSize={applicationPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={applications.length}
            totalPages={applicationPagination.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}
