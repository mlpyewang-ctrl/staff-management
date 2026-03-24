'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteSalaryRecord,
  getSalaryRecord,
  updateSalaryAdjustment,
  updateSalaryStatus,
} from '@/server/actions/salary'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

interface SalaryRecordDetail {
  id: string
  userId: string
  month: string
  baseSalary: number
  seniorityPay: number
  otherAdjustment: number
  adjustmentNote?: string | null
  salaryBase: number
  workdayOvertimeHours: number
  workdayOvertimePay: number
  weekendOvertimeHours: number
  weekendOvertimePay: number
  holidayOvertimeHours: number
  holidayOvertimePay: number
  totalOvertimePay: number
  compensatoryHours: number
  hourlySalary: number
  paidOvertimeHours: number
  compensatoryOvertimeHours: number
  totalOvertimeHours: number
  deduction: number
  netSalary: number
  status: string
  paidAt: Date | null
  createdAt: Date
  updatedAt: Date
  userName: string
  departmentName?: string
  positionName?: string
  user: {
    name: string
    email: string
    level?: string | null
  }
  overtimeSettlements: Array<{
    id: string
    hours: number
    settlementType: string
    overtime: {
      date: Date
      type: string
      hours: number
    }
  }>
}

export default function SalaryDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const salaryId = params.id as string

  const [record, setRecord] = useState<SalaryRecordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const [adjustmentForm, setAdjustmentForm] = useState({
    amount: '',
    note: '',
  })

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    const loadRecord = async () => {
      const data = await getSalaryRecord(salaryId)
      setRecord(data as SalaryRecordDetail | null)
      if (data) {
        setAdjustmentForm({
          amount: String((data as SalaryRecordDetail).otherAdjustment ?? 0),
          note: (data as SalaryRecordDetail).adjustmentNote || '',
        })
      }
      setLoading(false)
    }

    if (salaryId) {
      loadRecord()
    }
  }, [session, router, salaryId])

  const handleStatusChange = async (newStatus: string) => {
    const formData = new FormData()
    formData.append('salaryId', salaryId)
    formData.append('status', newStatus)
    const result = await updateSalaryStatus(formData)
    if (result.success) {
      const data = await getSalaryRecord(salaryId)
      setRecord(data as SalaryRecordDetail | null)
    } else {
      alert(result.error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除这条薪资记录吗？')) return
    const result = await deleteSalaryRecord(salaryId)
    if (result.success) {
      router.push('/dashboard/salary')
    } else {
      alert(result.error)
    }
  }

  const handleAdjustmentSave = async () => {
    setSavingAdjustment(true)
    const formData = new FormData()
    formData.append('salaryId', salaryId)
    formData.append('amount', adjustmentForm.amount)
    if (adjustmentForm.note) {
      formData.append('note', adjustmentForm.note)
    }

    const result = await updateSalaryAdjustment(formData)
    setSavingAdjustment(false)

    if (result.success) {
      const data = await getSalaryRecord(salaryId)
      setRecord(data as SalaryRecordDetail | null)
      alert(result.success)
      return
    }

    alert(result.error)
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

  if (!record) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">薪资记录不存在</div>
        <div className="mt-4 text-center">
          <Link href="/dashboard/salary">
            <Button>返回列表</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/salary">
            <Button variant="ghost">&larr; 返回</Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">薪资详情</h1>
        </div>
        <div className="flex gap-2">
          {record.status === 'DRAFT' && (
            <>
              <Button onClick={() => handleStatusChange('CONFIRMED')}>确认薪资</Button>
              <Button variant="destructive" onClick={handleDelete}>
                删除
              </Button>
            </>
          )}
          {record.status === 'CONFIRMED' && (
            <Button onClick={() => handleStatusChange('PAID')}>标记已支付</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>员工信息</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">姓名</dt>
                <dd className="font-medium">{record.userName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">邮箱</dt>
                <dd>{record.user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">部门</dt>
                <dd>{record.departmentName || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">岗位</dt>
                <dd>{record.positionName || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">职级</dt>
                <dd>{record.user.level || '-'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>薪资信息</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">薪资月份</dt>
                <dd className="font-medium">{record.month}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">状态</dt>
                <dd>{getStatusBadge(record.status)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">计薪基数</dt>
                <dd>{formatCurrency(record.salaryBase)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">小时工资</dt>
                <dd>{formatCurrency(record.hourlySalary)}/小时</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">计薪加班时长</dt>
                <dd>{record.paidOvertimeHours} 小时</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">调休加班时长</dt>
                <dd>{record.compensatoryOvertimeHours} 小时</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">总加班时长</dt>
                <dd>{record.totalOvertimeHours} 小时</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">创建时间</dt>
                <dd>{formatDateTime(new Date(record.createdAt))}</dd>
              </div>
              {record.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">支付时间</dt>
                  <dd>{formatDateTime(new Date(record.paidAt))}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>加班费明细</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">工作日加班</dt>
                <dd>{record.workdayOvertimeHours} 小时 = {formatCurrency(record.workdayOvertimePay)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">周末加班</dt>
                <dd>{record.weekendOvertimeHours} 小时 = {formatCurrency(record.weekendOvertimePay)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">节假日加班</dt>
                <dd>{record.holidayOvertimeHours} 小时 = {formatCurrency(record.holidayOvertimePay)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>加班费合计</dt>
                <dd>{formatCurrency(record.totalOvertimePay)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>薪资汇总</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">基本工资</dt>
                <dd>{formatCurrency(record.baseSalary)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">工龄工资</dt>
                <dd className="text-green-600">+{formatCurrency(record.seniorityPay)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">其他调整</dt>
                <dd className={record.otherAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {record.otherAdjustment >= 0 ? '+' : ''}{formatCurrency(record.otherAdjustment)}
                </dd>
              </div>
              {record.adjustmentNote && (
                <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  调整说明：{record.adjustmentNote}
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">加班费</dt>
                <dd className="text-green-600">+{formatCurrency(record.totalOvertimePay)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">请假扣款</dt>
                <dd className="text-red-600">-{formatCurrency(record.deduction)}</dd>
              </div>
              {record.compensatoryHours > 0 && (
                <div className="flex justify-between border-b pb-2">
                  <dt className="text-gray-500">转调休</dt>
                  <dd>{record.compensatoryHours} 小时</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 text-lg font-bold">
                <dt>应发工资</dt>
                <dd className="text-blue-600">{formatCurrency(record.netSalary)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {record.status === 'DRAFT' && (
        <Card>
          <CardHeader>
            <CardTitle>手动微调</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
              <Input
                type="number"
                value={adjustmentForm.amount}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({ ...current, amount: event.target.value }))
                }
                placeholder="输入调整金额"
              />
              <Textarea
                rows={2}
                value={adjustmentForm.note}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="输入调整说明"
              />
              <Button onClick={handleAdjustmentSave} disabled={savingAdjustment}>
                {savingAdjustment ? '保存中...' : '保存调整'}
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              支持正负数。正数表示补贴，负数表示扣减。
            </div>
          </CardContent>
        </Card>
      )}

      {record.overtimeSettlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>加班清算明细</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">加班日期</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">类型</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">加班时长</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">清算时长</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">清算方式</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {record.overtimeSettlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td className="px-4 py-2 text-sm">{formatDate(new Date(settlement.overtime.date))}</td>
                    <td className="px-4 py-2 text-sm">
                      {settlement.overtime.type === 'WORKDAY'
                        ? '工作日'
                        : settlement.overtime.type === 'WEEKEND'
                        ? '周末'
                        : '节假日'}
                    </td>
                    <td className="px-4 py-2 text-sm">{settlement.overtime.hours} 小时</td>
                    <td className="px-4 py-2 text-sm">{settlement.hours} 小时</td>
                    <td className="px-4 py-2 text-sm">
                      <Badge variant={settlement.settlementType === 'SALARY' ? 'success' : 'default'}>
                        {settlement.settlementType === 'SALARY' ? '计薪' : '转调休'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
