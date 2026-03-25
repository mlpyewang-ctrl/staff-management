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
import { formatDateTime } from '@/lib/utils'
import { getPerformanceReviews } from '@/server/actions/performance'

type PerformanceReviewItem = Awaited<ReturnType<typeof getPerformanceReviews>>[number]

export default function PerformancePage() {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<PerformanceReviewItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')

  const canCreate = !!session?.user?.id
  const canEdit = !!session?.user?.id
  const showEmployeeColumn = session?.user?.role !== 'EMPLOYEE'

  useEffect(() => {
    const fetchReviews = async () => {
      const data = await getPerformanceReviews(session?.user?.id, session?.user?.role)
      setReviews(data)
    }

    if (session) {
      fetchReviews()
    }
  }, [session])

  const filteredReviews = useMemo(
    () => reviews.filter((review) => isWithinTimeRange(review.createdAt, timeRange)),
    [reviews, timeRange]
  )
  const pagination = useMemo(
    () => getPaginationState(filteredReviews.length, currentPage, pageSize),
    [currentPage, filteredReviews.length, pageSize]
  )
  const paginatedReviews = useMemo(
    () => filteredReviews.slice(pagination.startIndex, pagination.endIndex),
    [filteredReviews, pagination.endIndex, pagination.startIndex]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [timeRange, pageSize])

  useEffect(() => {
    if (pagination.currentPage !== currentPage) {
      setCurrentPage(pagination.currentPage)
    }
  }, [currentPage, pagination.currentPage])

  const emptyColSpan = 10 + (showEmployeeColumn ? 1 : 0) + (canEdit ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">绩效管理</h1>
          <p className="mt-2 text-sm text-slate-600">
            查看绩效记录、平均得分，并按创建时间筛选最近数据。
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/performance/new">新增绩效记录</Link>
          </Button>
        )}
      </div>

      <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>绩效记录</CardTitle>
            <div className="mt-2 text-sm text-slate-500">当前共 {filteredReviews.length} 条记录</div>
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
                <TableHead>期间</TableHead>
                {showEmployeeColumn && <TableHead>员工</TableHead>}
                <TableHead>工作质量</TableHead>
                <TableHead>工作效率</TableHead>
                <TableHead>工作态度</TableHead>
                <TableHead>专业技能</TableHead>
                <TableHead>团队协作</TableHead>
                <TableHead>平均分</TableHead>
                <TableHead>评价</TableHead>
                <TableHead>自评</TableHead>
                <TableHead>创建时间</TableHead>
                {canEdit && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={emptyColSpan} className="py-8 text-center text-slate-500">
                    当前筛选条件下暂无绩效记录
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>{review.period}</TableCell>
                    {showEmployeeColumn && <TableCell>{review.userName}</TableCell>}
                    <TableCell>{review.quality}</TableCell>
                    <TableCell>{review.efficiency}</TableCell>
                    <TableCell>{review.attitude}</TableCell>
                    <TableCell>{review.skill}</TableCell>
                    <TableCell>{review.teamwork}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          review.totalScore >= 4 ? 'success' : review.totalScore >= 3 ? 'default' : 'warning'
                        }
                      >
                        {review.totalScore.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{review.comment || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{review.selfComment || '-'}</TableCell>
                    <TableCell>{formatDateTime(new Date(review.createdAt))}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/performance/${review.id}`}>编辑</Link>
                        </Button>
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
            totalItems={filteredReviews.length}
            totalPages={pagination.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}
