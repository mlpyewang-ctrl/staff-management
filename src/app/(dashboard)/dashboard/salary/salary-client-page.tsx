'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { buildSalaryExcelContent, type SalaryExportRow } from '@/lib/salary-export'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, getPaginationState } from '@/lib/pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { formatCurrency } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useAsyncAction } from '@/lib/use-async-action'
import { getDepartments } from '@/server/actions/department'
import {
  applySalaryBatchAdjustment,
  batchConfirmSalaryRecords,
  batchDeleteSalaryRecords,
  deleteSalaryRecord,
  getSalaryExportData,
  getSalaryMonths,
  getSalaryRecords,
  getSalaryStats,
  updateSalaryStatus,
} from '@/server/actions/salary'

type SalaryRecordsData = Awaited<ReturnType<typeof getSalaryRecords>>
type SalaryStatsData = Awaited<ReturnType<typeof getSalaryStats>>
type DepartmentsData = Awaited<ReturnType<typeof getDepartments>>
type SalaryRecordItem = SalaryRecordsData[number]
type SalaryStats = Exclude<SalaryStatsData, null>

const ADJUSTABLE_FIELDS = [
  { value: 'otherAdjustment', label: '其他调整' },
  { value: 'classLeaderAllowance', label: '班长补助' },
  { value: 'dormHeadAllowance', label: '宿舍负责人补助' },
  { value: 'electricityAllowance', label: '电费补助' },
  { value: 'supplementalPay', label: '补发工资' },
  { value: 'deductionAdjustment', label: '补扣工资' },
] as const

const emptyFilters = {
  month: '',
  departmentId: '',
  status: '',
}

interface SalaryClientPageProps {
  initialDepartments: DepartmentsData
  initialMonths: string[]
  initialRecords: SalaryRecordsData
  initialStats: SalaryStatsData
}

export function SalaryClientPage({
  initialDepartments,
  initialMonths,
  initialRecords,
  initialStats,
}: SalaryClientPageProps) {
  const [records, setRecords] = useState(initialRecords)
  const [stats, setStats] = useState(initialStats)
  const [departments, setDepartments] = useState(initialDepartments)
  const [months, setMonths] = useState(initialMonths)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [searchName, setSearchName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adjustmentForm, setAdjustmentForm] = useState({
    field: 'otherAdjustment',
    amount: '',
    note: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const batchAdjustmentAction = useAsyncAction(applySalaryBatchAdjustment, {
    onError: (message) => alert(message),
  })
  const batchDeleteAction = useAsyncAction(batchDeleteSalaryRecords, {
    onError: (message) => alert(message),
  })
  const batchConfirmAction = useAsyncAction(batchConfirmSalaryRecords, {
    onError: (message) => alert(message),
  })
  const exportAction = useAsyncAction(getSalaryExportData, {
    onError: (message) => alert(message),
  })
  const statusAction = useAsyncAction(updateSalaryStatus, {
    onError: (message) => alert(message),
  })
  const deleteRecordAction = useAsyncAction(deleteSalaryRecord, {
    onError: (message) => alert(message),
  })

  const hasInitialized = useRef(false)

  useEffect(() => {
    setRecords(initialRecords)
  }, [initialRecords])

  useEffect(() => {
    setStats(initialStats)
  }, [initialStats])

  useEffect(() => {
    setDepartments(initialDepartments)
  }, [initialDepartments])

  useEffect(() => {
    setMonths(initialMonths)
  }, [initialMonths])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [recordsData, statsData, departmentOptions, monthOptions] = await Promise.all([
      getSalaryRecords(filters),
      getSalaryStats(filters.month || undefined),
      getDepartments(),
      getSalaryMonths(),
    ])

    setRecords(recordsData)
    setStats(statsData)
    setDepartments(departmentOptions)
    setMonths(monthOptions)
    setSelectedIds(new Set())
    setLoading(false)
  }, [filters])

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      return
    }

    void loadData()
  }, [loadData])

  const filteredRecords = records.filter((record) => {
    if (!searchName.trim()) return true
    return record.userName?.toLowerCase().includes(searchName.trim().toLowerCase())
  })

  const pagination = useMemo(
    () => getPaginationState(filteredRecords.length, currentPage, pageSize),
    [filteredRecords.length, currentPage, pageSize]
  )
  const paginatedRecords = useMemo(
    () => filteredRecords.slice(pagination.startIndex, pagination.endIndex),
    [filteredRecords, pagination.endIndex, pagination.startIndex]
  )

  const draftRecords = filteredRecords.filter((r) => r.status === 'DRAFT')
  const allDraftSelected = draftRecords.length > 0 && draftRecords.every((r) => selectedIds.has(r.id))

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchName, pageSize])

  useEffect(() => {
    if (pagination.currentPage !== currentPage) {
      setCurrentPage(pagination.currentPage)
    }
  }, [currentPage, pagination.currentPage])

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedIds)
      draftRecords.forEach((r) => newSelected.add(r.id))
      setSelectedIds(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      draftRecords.forEach((r) => newSelected.delete(r.id))
      setSelectedIds(newSelected)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger'; text: string }> = {
      DRAFT: { variant: 'default', text: '草稿' },
      CONFIRMED: { variant: 'warning', text: '已确认' },
      PAID: { variant: 'success', text: '已支付' },
    }

    const config = statusConfig[status] || { variant: 'default', text: status }
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    const formData = new FormData()
    formData.append('salaryId', id)
    formData.append('status', newStatus)

    const result = await statusAction.execute(formData)
    if (result && typeof result === 'object' && 'error' in result && !('success' in result)) {
      return
    }

    if (result.success) {
      await loadData()
      return
    }

    alert(result.error)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条薪资记录吗？')) {
      return
    }

    const result = await deleteRecordAction.execute(id)
    if (result && typeof result === 'object' && 'error' in result && !('success' in result)) {
      return
    }

    if (result.success) {
      await loadData()
      return
    }

    alert(result.error)
  }

  const handleExport = async () => {
    if (!filters.month) {
      alert('请先选择要导出的月份')
      return
    }

    const exportData = await exportAction.execute(filters)
    if (exportData && typeof exportData === 'object' && 'error' in exportData && !Array.isArray(exportData)) {
      return
    }

    if ((exportData as SalaryExportRow[]).length === 0) {
      alert('当前月份没有可导出的薪资数据')
      return
    }

    const excelContent = buildSalaryExcelContent(exportData as SalaryExportRow[])
    const blob = new Blob(['\ufeff', excelContent], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    })

    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `薪资月报_${filters.month}_${new Date().toISOString().split('T')[0]}.xls`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleBatchAdjustment = async () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要调整的薪资记录')
      return
    }

    if (!adjustmentForm.amount) {
      alert('请输入调整金额')
      return
    }

    const formData = new FormData()
    selectedIds.forEach((id) => formData.append('recordIds', id))
    formData.append('field', adjustmentForm.field)
    formData.append('amount', adjustmentForm.amount)
    if (adjustmentForm.note) {
      formData.append('note', adjustmentForm.note)
    }

    const result = await batchAdjustmentAction.execute(formData)
    if (result && typeof result === 'object' && 'error' in result && !('success' in result)) {
      return
    }

    if (result.success) {
      alert(result.success)
      setSelectedIds(new Set())
      await loadData()
      return
    }

    alert(result.error)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要删除的薪资记录')
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条薪资记录吗？`)) {
      return
    }

    const result = await batchDeleteAction.execute(Array.from(selectedIds))
    if (result && typeof result === 'object' && 'error' in result && !('success' in result)) {
      return
    }

    if (result.success) {
      alert(result.success)
      setSelectedIds(new Set())
      await loadData()
      return
    }

    alert(result.error)
  }

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要确认的薪资记录')
      return
    }

    if (!confirm(`确定要确认选中的 ${selectedIds.size} 条薪资记录吗？确认后不可重新生成覆盖。`)) {
      return
    }

    const result = await batchConfirmAction.execute(Array.from(selectedIds))
    if (result && typeof result === 'object' && 'error' in result && !('success' in result)) {
      return
    }

    if (result.success) {
      alert(result.success)
      setSelectedIds(new Set())
      await loadData()
      return
    }

    alert(result.error)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">薪资管理</h1>
          <p className="mt-1 text-sm text-gray-600">支持工龄工资、批量补贴调整和按月导出 Excel。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/salary/generate">
            <Button>生成薪资</Button>
          </Link>
          <Button
            onClick={() => void handleExport()}
            disabled={!filters.month}
            loading={exportAction.loading}
            className="border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:border-emerald-300 disabled:bg-emerald-300"
          >
            按月导出 Excel
          </Button>
        </div>
      </div>

      {stats && <SalaryStatsCards stats={stats} />}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <FilterSelect
              label="月份"
              value={filters.month}
              onChange={(value) => setFilters((current) => ({ ...current, month: value }))}
            >
              <option value="">请选择月份</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="部门"
              value={filters.departmentId}
              onChange={(value) => setFilters((current) => ({ ...current, departmentId: value }))}
            >
              <option value="">全部部门</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="状态"
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            >
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="CONFIRMED">已确认</option>
              <option value="PAID">已支付</option>
            </FilterSelect>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">搜索姓名</label>
              <Input
                type="text"
                placeholder="输入员工姓名"
                value={searchName}
                onChange={(event) => setSearchName(event.target.value)}
                className="w-40"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            导出字段包含：姓名、基础工资、工龄工资、学历工资、班长补助、宿舍负责人补助、电费补助、加班费、补发工资、补扣工资、请假、小计。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
              <span className="ml-2 text-sm text-gray-500">加载中...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={allDraftSelected}
                        onChange={(event) => handleSelectAll(event.target.checked)}
                        disabled={draftRecords.length === 0}
                      />
                    </TableHead>
                    <TableHead>员工</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>月份</TableHead>
                    <TableHead>基础工资</TableHead>
                    <TableHead>工龄工资</TableHead>
                    <TableHead>学历工资</TableHead>
                    <TableHead>班长补助</TableHead>
                    <TableHead>宿舍负责人补助</TableHead>
                    <TableHead>电费补助</TableHead>
                    <TableHead>加班费</TableHead>
                    <TableHead>补发工资</TableHead>
                    <TableHead>补扣工资</TableHead>
                    <TableHead>请假</TableHead>
                    <TableHead>小计</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={17} className="text-center text-gray-500">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecords.map((record) => (
                      <SalaryRecordRow
                        key={record.id}
                        getStatusBadge={getStatusBadge}
                        isSelected={selectedIds.has(record.id)}
                        onDelete={handleDelete}
                        onSelect={handleSelectOne}
                        onStatusChange={handleStatusChange}
                        record={record}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={pagination.currentPage}
              itemLabel="条记录"
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={filteredRecords.length}
              totalPages={pagination.totalPages}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>批量调整</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">调整字段</label>
              <select
                className="block rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={adjustmentForm.field}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({ ...current, field: event.target.value }))
                }
              >
                {ADJUSTABLE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">调整金额</label>
              <Input
                type="number"
                placeholder="如 500"
                value={adjustmentForm.amount}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({ ...current, amount: event.target.value }))
                }
                className="w-40"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">调整说明</label>
              <Input
                type="text"
                placeholder="可选"
                value={adjustmentForm.note}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </div>
            <Button
              onClick={() => void handleBatchAdjustment()}
              disabled={selectedIds.size === 0 || !adjustmentForm.amount}
              loading={batchAdjustmentAction.loading}
            >
              批量调整
            </Button>
            <Button
              variant="default"
              onClick={() => void handleBatchConfirm()}
              disabled={selectedIds.size === 0}
              loading={batchConfirmAction.loading}
            >
              {`批量确认 (${selectedIds.size})`}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleBatchDelete()}
              disabled={selectedIds.size === 0}
              loading={batchDeleteAction.loading}
            >
              {`批量删除 (${selectedIds.size})`}
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            {selectedIds.size > 0
              ? `已勾选 ${selectedIds.size} 条草稿记录，可进行批量调整或批量删除。`
              : '请先在上方的表格中勾选需要操作的草稿记录。'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SalaryStatsCards({ stats }: { stats: SalaryStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="记录数" value={String(stats.totalRecords)} />
      <StatCard label="基本工资合计" value={formatCurrency(stats.totalBaseSalary)} />
      <StatCard label="工龄工资合计" value={formatCurrency(stats.totalSeniorityPay)} />
      <StatCard label="其他调整合计" value={formatCurrency(stats.totalOtherAdjustment)} />
      <StatCard label="加班费合计" value={formatCurrency(stats.totalOvertimePay)} />
      <StatCard label="应发工资合计" value={formatCurrency(stats.totalNetSalary)} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  )
}

function SalaryRecordRow({
  getStatusBadge,
  isSelected,
  onDelete,
  onSelect,
  onStatusChange,
  record,
}: {
  getStatusBadge: (status: string) => ReactNode
  isSelected: boolean
  onDelete: (id: string) => Promise<void>
  onSelect: (id: string, checked: boolean) => void
  onStatusChange: (id: string, newStatus: string) => Promise<void>
  record: SalaryRecordItem
}) {
  const isDraft = record.status === 'DRAFT'
  const pureBaseSalary = record.baseSalary - (record.educationSalary ?? 0)

  return (
    <TableRow>
      <TableCell>
        {isDraft ? (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={isSelected}
            onChange={(event) => onSelect(record.id, event.target.checked)}
          />
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
      </TableCell>
      <TableCell>{record.userName}</TableCell>
      <TableCell>{record.departmentName || '-'}</TableCell>
      <TableCell>{record.month}</TableCell>
      <TableCell>{formatCurrency(pureBaseSalary)}</TableCell>
      <TableCell>{formatCurrency(record.seniorityPay)}</TableCell>
      <TableCell>{formatCurrency(record.educationSalary ?? 0)}</TableCell>
      <TableCell>{formatCurrency(record.classLeaderAllowance)}</TableCell>
      <TableCell>{formatCurrency(record.dormHeadAllowance)}</TableCell>
      <TableCell>{formatCurrency(record.electricityAllowance)}</TableCell>
      <TableCell>{formatCurrency(record.totalOvertimePay)}</TableCell>
      <TableCell>{formatCurrency(record.supplementalPay)}</TableCell>
      <TableCell>{formatCurrency(record.deductionAdjustment)}</TableCell>
      <TableCell>{formatCurrency(record.deduction)}</TableCell>
      <TableCell className="font-semibold">{formatCurrency(record.netSalary)}</TableCell>
      <TableCell>{getStatusBadge(record.status)}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Link href={`/dashboard/salary/${record.id}`}>
            <Button variant="ghost" size="sm">
              详情
            </Button>
          </Link>
          {record.status === 'DRAFT' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => void onStatusChange(record.id, 'CONFIRMED')}>
                确认
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void onDelete(record.id)}>
                删除
              </Button>
            </>
          )}
          {record.status === 'CONFIRMED' && (
            <Button variant="ghost" size="sm" onClick={() => void onStatusChange(record.id, 'PAID')}>
              支付
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
