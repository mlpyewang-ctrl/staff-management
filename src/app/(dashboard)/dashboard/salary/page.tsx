'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  getSalaryRecords,
  getSalaryStats,
  getSalaryExportData,
  updateSalaryStatus,
  deleteSalaryRecord,
} from '@/server/actions/salary'
import { getDepartments } from '@/server/actions/department'
import { formatCurrency, formatDate } from '@/lib/utils'

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

export default function SalaryPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [records, setRecords] = useState<SalaryRecord[]>([])
  const [stats, setStats] = useState<SalaryStats | null>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    month: '',
    departmentId: '',
    status: '',
  })

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    const loadData = async () => {
      setLoading(true)
      const [recordsData, statsData, depts] = await Promise.all([
        getSalaryRecords(filters),
        getSalaryStats(filters.month || undefined),
        getDepartments(),
      ])
      setRecords(recordsData)
      setStats(statsData)
      setDepartments(depts)
      setLoading(false)
    }

    loadData()
  }, [session, router, filters])

  const handleStatusChange = async (id: string, newStatus: string) => {
    const formData = new FormData()
    formData.append('salaryId', id)
    formData.append('status', newStatus)
    const result = await updateSalaryStatus(formData)
    if (result.success) {
      const recordsData = await getSalaryRecords(filters)
      setRecords(recordsData)
    } else {
      alert(result.error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条薪资记录吗？')) return
    const result = await deleteSalaryRecord(id)
    if (result.success) {
      const recordsData = await getSalaryRecords(filters)
      setRecords(recordsData)
    } else {
      alert(result.error)
    }
  }

  const handleExport = async () => {
    const exportData = await getSalaryExportData(filters)
    if (exportData.length === 0) {
      alert('没有可导出的数据')
      return
    }

    // 生成 CSV
    const headers = Object.keys(exportData[0])
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(h => {
          const value = (row as any)[h]
          // 处理包含逗号的值
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value
        }).join(',')
      ),
    ].join('\n')

    // 添加 BOM 以支持中文
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `薪资记录_${filters.month || '全部'}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
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

  if (loading) {
    return <div className="p-6">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">薪资管理</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/salary/generate">
            <Button>生成薪资</Button>
          </Link>
          <Button variant="outline" onClick={handleExport}>
            导出Excel
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
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

      {/* 筛选条件 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
              <input
                type="month"
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
              <select
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={filters.departmentId}
                onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select
                className="block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="CONFIRMED">已确认</option>
                <option value="PAID">已支付</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 薪资记录列表 */}
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
                <TableHead>转调休</TableHead>
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
