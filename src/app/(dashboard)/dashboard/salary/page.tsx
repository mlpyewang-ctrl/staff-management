'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  deleteSalaryRecord,
  getSalaryExportData,
  getSalaryMonths,
  getSalaryRecords,
  getSalaryStats,
  updateSalaryStatus,
} from '@/server/actions/salary'
import { getDepartments } from '@/server/actions/department'
import { formatCurrency } from '@/lib/utils'

interface SalaryRecord {
  id: string
  userId: string
  month: string
  baseSalary: number
  workdayOvertimeHours: number
  workdayOvertimePay: number
  weekendOvertimeHours: number
  weekendOvertimePay: number
  holidayOvertimeHours: number
  holidayOvertimePay: number
  totalOvertimePay: number
  compensatoryHours: number
  deduction: number
  netSalary: number
  status: string
  createdAt: Date
  userName: string
  departmentName?: string
  positionName?: string
}

interface SalaryStats {
  totalRecords: number
  totalBaseSalary: number
  totalOvertimePay: number
  totalDeduction: number
  totalNetSalary: number
  totalCompensatoryHours: number
  statusBreakdown: Array<{ status: string; count: number }>
}

interface DepartmentOption {
  id: string
  name: string
}

interface ExportRow {
  [key: string]: string | number
}

export default function SalaryPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [records, setRecords] = useState<SalaryRecord[]>([])
  const [stats, setStats] = useState<SalaryStats | null>(null)
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    month: '',
    departmentId: '',
    status: '',
  })

  const loadData = async () => {
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
    setLoading(false)
  }

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    loadData()
  }, [session, router, filters])

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

    const result = await updateSalaryStatus(formData)
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

    const result = await deleteSalaryRecord(id)
    if (result.success) {
      await loadData()
      return
    }

    alert(result.error)
  }

  const buildExcelContent = (rows: ExportRow[]) => {
    const headers = Object.keys(rows[0])
    const escapeCell = (value: string | number) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

    const headerHtml = headers
      .map(
        (header) =>
          `<th style="border:1px solid #cbd5e1;background:#eff6ff;padding:8px 12px;text-align:left;">${escapeCell(header)}</th>`
      )
      .join('')

    const bodyHtml = rows
      .map((row) => {
        const cells = headers
          .map(
            (header) =>
              `<td style="border:1px solid #cbd5e1;padding:8px 12px;">${escapeCell(row[header])}</td>`
          )
          .join('')

        return `<tr>${cells}</tr>`
      })
      .join('')

    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table>
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </body>
      </html>
    `
  }

  const handleExport = async () => {
    if (!filters.month) {
      alert('请先选择要导出的月份')
      return
    }

    const exportData = (await getSalaryExportData(filters)) as ExportRow[]
    if (exportData.length === 0) {
      alert('当前月份没有可导出的薪资数据')
      return
    }

    const excelContent = buildExcelContent(exportData)
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

  if (loading) {
    return <div className="p-6">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">薪资管理</h1>
          <p className="mt-1 text-sm text-gray-600">支持按月导出 Excel，包含薪资、加班工资、加班时长和调休时长。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/salary/generate">
            <Button>生成薪资</Button>
          </Link>
          <Button variant="outline" onClick={handleExport} disabled={!filters.month}>
            按月导出 Excel
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">记录数</div>
              <div className="text-2xl font-bold">{stats.totalRecords}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">基本工资合计</div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalBaseSalary)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">加班费合计</div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalOvertimePay)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">扣款合计</div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalDeduction)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">应发工资合计</div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalNetSalary)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">月份</label>
              <select
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={filters.month}
                onChange={(event) => setFilters({ ...filters, month: event.target.value })}
              >
                <option value="">请选择月份</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">部门</label>
              <select
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={filters.departmentId}
                onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}
              >
                <option value="">全部部门</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">状态</label>
              <select
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              >
                <option value="">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="CONFIRMED">已确认</option>
                <option value="PAID">已支付</option>
              </select>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            导出字段：薪资、工作日加班工资、工作日加班时长、周末日加班工资、周末日加班时长、法定节假日加班工资、加班时长、调休时长。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>月份</TableHead>
                <TableHead>基本工资</TableHead>
                <TableHead>加班费</TableHead>
                <TableHead>调休时长</TableHead>
                <TableHead>扣款</TableHead>
                <TableHead>应发工资</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.userName}</TableCell>
                    <TableCell>{record.departmentName || '-'}</TableCell>
                    <TableCell>{record.month}</TableCell>
                    <TableCell>{formatCurrency(record.baseSalary)}</TableCell>
                    <TableCell>{formatCurrency(record.totalOvertimePay)}</TableCell>
                    <TableCell>{record.compensatoryHours}h</TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(record.id, 'CONFIRMED')}
                            >
                              确认
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => handleDelete(record.id)}
                            >
                              删除
                            </Button>
                          </>
                        )}
                        {record.status === 'CONFIRMED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(record.id, 'PAID')}
                          >
                            支付
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
