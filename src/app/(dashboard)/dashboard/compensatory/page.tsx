'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  getCompensatoryInfo,
  getCompensatoryUsageHistory,
  getCompensatorySourceHistory,
  useCompensatory,
} from '@/server/actions/compensatory'
import { formatDate, formatDateTime } from '@/lib/utils'
import { SALARY_CONSTANTS } from '@/types'

interface CompensatoryInfo {
  totalCompensatory: number
  availableCompensatory: number
  usedCompensatory: number
  settledOvertimeHours: number
}

interface UsageHistory {
  id: string
  date: Date
  days: number
  hours: number
  reason: string
  status: string
  createdAt: Date
}

interface SourceHistory {
  id: string
  date: Date
  hours: number
  overtimeType: string
  salaryMonth?: string
  createdAt: Date
}

export default function CompensatoryPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [info, setInfo] = useState<CompensatoryInfo | null>(null)
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([])
  const [sourceHistory, setSourceHistory] = useState<SourceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showUseForm, setShowUseForm] = useState(false)
  const [formData, setFormData] = useState({
    hours: '8',
    startDate: '',
    reason: '',
  })
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null)

  useEffect(() => {
    if (!session?.user) {
      router.push('/auth/login')
      return
    }

    const loadData = async () => {
      setLoading(true)
      const [infoData, usageData, sourceData] = await Promise.all([
        getCompensatoryInfo(session.user.id),
        getCompensatoryUsageHistory(session.user.id),
        getCompensatorySourceHistory(session.user.id),
      ])
      setInfo(infoData)
      setUsageHistory(usageData)
      setSourceHistory(sourceData)
      setLoading(false)
    }

    loadData()
  }, [session, router])

  const handleUseCompensatory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user) return

    setResult(null)
    const submitData = new FormData()
    submitData.append('userId', session.user.id)
    submitData.append('hours', formData.hours)
    submitData.append('startDate', formData.startDate)
    submitData.append('reason', formData.reason)

    const res = await useCompensatory(submitData)
    setResult(res)

    if (res.success) {
      const [infoData, usageData] = await Promise.all([
        getCompensatoryInfo(session.user.id),
        getCompensatoryUsageHistory(session.user.id),
      ])
      setInfo(infoData)
      setUsageHistory(usageData)
      setShowUseForm(false)
      setFormData({ hours: '8', startDate: '', reason: '' })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger'; text: string }> = {
      PENDING: { variant: 'warning', text: '待审批' },
      APPROVED: { variant: 'success', text: '已通过' },
      REJECTED: { variant: 'danger', text: '已拒绝' },
      DRAFT: { variant: 'default', text: '草稿' },
    }
    const config = statusConfig[status] || { variant: 'default', text: status }
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  const getOvertimeTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      WORKDAY: '工作日',
      WEEKEND: '周末',
      HOLIDAY: '节假日',
    }
    return typeMap[type] || type
  }

  if (loading) {
    return <div className="p-6">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">调休管理</h1>
        {info && info.availableCompensatory >= SALARY_CONSTANTS.HALF_DAY_HOURS && (
          <Button onClick={() => setShowUseForm(!showUseForm)}>
            {showUseForm ? '取消' : '申请调休'}
          </Button>
        )}
      </div>

      {info && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">累计调休</div>
              <div className="text-2xl font-bold">{info.totalCompensatory} 小时</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">可用调休</div>
              <div className="text-2xl font-bold text-green-600">{info.availableCompensatory} 小时</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">已使用调休</div>
              <div className="text-2xl font-bold">{info.usedCompensatory} 小时</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-gray-500">已清算加班</div>
              <div className="text-2xl font-bold">{info.settledOvertimeHours} 小时</div>
            </CardContent>
          </Card>
        </div>
      )}

      {showUseForm && (
        <Card>
          <CardHeader>
            <CardTitle>申请调休</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUseCompensatory} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    调休时长 <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    required
                  >
                    <option value="8">一天（8小时）</option>
                    <option value="4">半天（4小时）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    调休日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">可用调休</label>
                  <div className="px-3 py-2 text-green-600 font-medium">
                    {info?.availableCompensatory || 0} 小时
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  调休事由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="请详细描述调休事由（至少 10 个字符）"
                  required
                />
              </div>

              {result && (
                <div
                  className={`p-4 rounded-md ${
                    result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {result.success || result.error}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit">提交申请</Button>
                <Button type="button" variant="outline" onClick={() => setShowUseForm(false)}>
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>调休来源</CardTitle>
        </CardHeader>
        <CardContent>
          {sourceHistory.length === 0 ? (
            <div className="text-center text-gray-500 py-4">暂无调休来源记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>加班日期</TableHead>
                  <TableHead>加班类型</TableHead>
                  <TableHead>转调休时长</TableHead>
                  <TableHead>来源薪资月份</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(new Date(item.date))}</TableCell>
                    <TableCell>{getOvertimeTypeText(item.overtimeType)}</TableCell>
                    <TableCell>{item.hours} 小时</TableCell>
                    <TableCell>{item.salaryMonth || '-'}</TableCell>
                    <TableCell>{formatDateTime(new Date(item.createdAt))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>调休使用记录</CardTitle>
        </CardHeader>
        <CardContent>
          {usageHistory.length === 0 ? (
            <div className="text-center text-gray-500 py-4">暂无调休使用记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>调休日期</TableHead>
                  <TableHead>时长</TableHead>
                  <TableHead>事由</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(new Date(item.date))}</TableCell>
                    <TableCell>{item.hours} 小时</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{formatDateTime(new Date(item.createdAt))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>调休说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>调休来源于月加班超过36小时的部分自动转换</li>
            <li>调休使用可选择一天（8小时）或半天（4小时）</li>
            <li>调休申请需要经过审批流程</li>
            <li>调休申请被拒绝后，调休时长会自动返还</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
