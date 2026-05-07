'use client'

import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  getPaginationState,
} from '@/lib/pagination'
import {
  buildOvertimeExportRows,
  buildLeaveExportRows,
  buildQueryExcelContent,
} from '@/lib/query-export'
import type { TimeRange } from '@/lib/time-range'
import { timeRangeOptions } from '@/lib/time-range'
import {
  getQueryOvertimeList,
  getQueryLeaveList,
  exportOvertimeQuery,
  exportLeaveQuery,
  type QueryFilters,
} from '@/server/actions/query'
import { getDepartments } from '@/server/actions/department'

type DepartmentItem = Awaited<ReturnType<typeof getDepartments>>[number]

type OvertimeItem = Awaited<ReturnType<typeof getQueryOvertimeList>>['items'][number]
type LeaveItem = Awaited<ReturnType<typeof getQueryLeaveList>>['items'][number]

type TabType = 'overtime' | 'leave'

const overtimeStatusOptions = [
  { value: '', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING', label: '事前审批中' },
  { value: 'PRE_APPROVED', label: '事前通过待确认' },
  { value: 'CONFIRM_PENDING', label: '确认审批中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'REJECTED', label: '已退回' },
]

const leaveStatusOptions = [
  { value: '', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING', label: '审批中' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'REJECTED', label: '已退回' },
]

const overtimeTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'WORKDAY', label: '工作日' },
  { value: 'WEEKEND', label: '周末' },
  { value: 'HOLIDAY', label: '节假日' },
]

const leaveTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'ANNUAL', label: '年假' },
  { value: 'SICK', label: '病假' },
  { value: 'PERSONAL', label: '事假' },
  { value: 'MARRIAGE', label: '婚假' },
  { value: 'MATERNITY', label: '产假' },
  { value: 'PATERNITY', label: '陪产假' },
  { value: 'COMPENSATORY', label: '调休' },
]

const statusVariantMap: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  PRE_APPROVED: 'info',
  CONFIRM_PENDING: 'warning',
  COMPLETED: 'success',
  APPROVED: 'success',
  REJECTED: 'danger',
}

interface QueryClientPageProps {
  departments: DepartmentItem[]
}

export function QueryClientPage({ departments }: QueryClientPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overtime')
  const [filters, setFilters] = useState<QueryFilters>({
    departmentId: '',
    userName: '',
    timeRange: 'all',
    status: '',
    type: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [overtimeData, setOvertimeData] = useState<OvertimeItem[]>([])
  const [overtimeTotal, setOvertimeTotal] = useState(0)
  const [leaveData, setLeaveData] = useState<LeaveItem[]>([])
  const [leaveTotal, setLeaveTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (activeTab === 'overtime') {
      const result = await getQueryOvertimeList(filters, currentPage, pageSize)
      setOvertimeData(result.items)
      setOvertimeTotal(result.total)
    } else {
      const result = await getQueryLeaveList(filters, currentPage, pageSize)
      setLeaveData(result.items)
      setLeaveTotal(result.total)
    }
    setLoading(false)
  }, [activeTab, filters, currentPage, pageSize])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, filters])

  const pagination = getPaginationState(
    activeTab === 'overtime' ? overtimeTotal : leaveTotal,
    currentPage,
    pageSize
  )

  const handleExport = async () => {
    if (activeTab === 'overtime') {
      const records = await exportOvertimeQuery(filters)
      if (records.length === 0) {
        alert('当前筛选条件下没有可导出的加班数据')
        return
      }
      const rows = buildOvertimeExportRows(records)
      const excelContent = buildQueryExcelContent(rows)
      const blob = new Blob(['\ufeff', excelContent], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = `加班查询_${new Date().toISOString().split('T')[0]}.xls`
      link.click()
      URL.revokeObjectURL(url)
    } else {
      const records = await exportLeaveQuery(filters)
      if (records.length === 0) {
        alert('当前筛选条件下没有可导出的请假数据')
        return
      }
      const rows = buildLeaveExportRows(records)
      const excelContent = buildQueryExcelContent(rows)
      const blob = new Blob(['\ufeff', excelContent], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = `请假查询_${new Date().toISOString().split('T')[0]}.xls`
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  const updateFilter = (key: keyof QueryFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">查询统计</h1>
          <p className="mt-2 text-sm text-slate-600">
            按部门、人名等条件查询休假与加班记录，支持导出 Excel。
          </p>
        </div>
        <Button
          onClick={handleExport}
          className="border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        >
          导出 Excel
        </Button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overtime')}
          className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'overtime'
              ? 'bg-slate-950 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          加班查询
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'leave'
              ? 'bg-slate-950 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          休假查询
        </button>
      </div>

      {/* 筛选栏 */}
      <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-sm font-medium text-slate-700">部门</label>
              <Select
                value={filters.departmentId}
                onChange={(event) => updateFilter('departmentId', event.target.value)}
              >
                <option value="">全部部门</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-sm font-medium text-slate-700">人名</label>
              <Input
                placeholder="搜索姓名"
                value={filters.userName}
                onChange={(event) => updateFilter('userName', event.target.value)}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-sm font-medium text-slate-700">时间范围</label>
              <Select
                value={filters.timeRange}
                onChange={(event) =>
                  updateFilter('timeRange', event.target.value as TimeRange)
                }
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-sm font-medium text-slate-700">状态</label>
              <Select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
              >
                {activeTab === 'overtime'
                  ? overtimeStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  : leaveStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
              </Select>
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-sm font-medium text-slate-700">类型</label>
              <Select
                value={filters.type}
                onChange={(event) => updateFilter('type', event.target.value)}
              >
                {activeTab === 'overtime'
                  ? overtimeTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  : leaveTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>
            {activeTab === 'overtime' ? '加班记录' : '休假记录'}
            <span className="ml-2 text-sm font-normal text-slate-500">
              共 {activeTab === 'overtime' ? overtimeTotal : leaveTotal} 条
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">加载中...</div>
          ) : activeTab === 'overtime' ? (
            <OvertimeTable data={overtimeData} />
          ) : (
            <LeaveTable data={leaveData} />
          )}
        </CardContent>
        <CardContent className="pt-0">
          <PaginationControls
            currentPage={pagination.currentPage}
            itemLabel="条记录"
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={activeTab === 'overtime' ? overtimeTotal : leaveTotal}
            totalPages={pagination.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function OvertimeTable({ data }: { data: OvertimeItem[] }) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">当前筛选条件下暂无加班记录</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日期</TableHead>
            <TableHead>申请人</TableHead>
            <TableHead>部门</TableHead>
            <TableHead>时间段</TableHead>
            <TableHead>计划时长</TableHead>
            <TableHead>实际时长</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>事由</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>备注</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{new Date(item.date).toLocaleDateString('zh-CN')}</TableCell>
              <TableCell>{item.userName}</TableCell>
              <TableCell>{item.departmentName || '-'}</TableCell>
              <TableCell>
                {new Date(item.startTime).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -{' '}
                {new Date(item.endTime).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell>{item.hours} 小时</TableCell>
              <TableCell>
                {item.actualHours ? `${item.actualHours} 小时` : '-'}
              </TableCell>
              <TableCell>
                {item.type === 'WEEKEND' ? '周末' : item.type === 'HOLIDAY' ? '节假日' : '工作日'}
              </TableCell>
              <TableCell className="max-w-xs truncate">{item.reason}</TableCell>
              <TableCell>
                <Badge variant={statusVariantMap[item.status] || 'default'}>
                  {item.statusText}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">{item.remark || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LeaveTable({ data }: { data: LeaveItem[] }) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">当前筛选条件下暂无休假记录</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>申请人</TableHead>
            <TableHead>部门</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>起止日期</TableHead>
            <TableHead>天数</TableHead>
            <TableHead>时段</TableHead>
            <TableHead>事由</TableHead>
            <TableHead>目的地</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>备注</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.userName}</TableCell>
              <TableCell>{item.departmentName || '-'}</TableCell>
              <TableCell>{item.leaveTypeText}</TableCell>
              <TableCell>
                {new Date(item.startDate).toLocaleDateString('zh-CN')} ~{' '}
                {new Date(item.endDate).toLocaleDateString('zh-CN')}
              </TableCell>
              <TableCell>{item.days} 天</TableCell>
              <TableCell>
                {item.startSession || item.endSession
                  ? `${item.startSession || ''} ~ ${item.endSession || ''}`
                  : '-'}
              </TableCell>
              <TableCell className="max-w-xs truncate">{item.reason}</TableCell>
              <TableCell>{item.destination || '-'}</TableCell>
              <TableCell>
                <Badge variant={statusVariantMap[item.status] || 'default'}>
                  {item.statusText}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">{item.remark || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
