'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getDepartments } from '@/server/actions/department'
import { generateSalaryRecords, getAvailableMonths } from '@/server/actions/salary'

export default function GenerateSalaryPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [departments, setDepartments] = useState<any[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    month: '',
    departmentId: '',
  })
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null)

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    const loadData = async () => {
      const [depts, months] = await Promise.all([getDepartments(), getAvailableMonths()])
      setDepartments(depts)
      setAvailableMonths(months)
      if (months.length > 0) {
        setFormData((prev) => ({ ...prev, month: months[0] }))
      }
    }

    loadData()
  }, [session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.month) {
      setResult({ error: '请选择月份' })
      return
    }

    setLoading(true)
    setResult(null)

    const submitData = new FormData()
    submitData.append('month', formData.month)
    if (formData.departmentId) {
      submitData.append('departmentId', formData.departmentId)
    }

    const res = await generateSalaryRecords(submitData)
    setResult(res)
    setLoading(false)

    if (res.success) {
      setTimeout(() => {
        router.push('/dashboard/salary')
      }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/salary">
          <Button variant="ghost">&larr; 返回</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">生成薪资记录</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>薪资生成规则</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>薪资月份：生成上个月的薪资记录</li>
            <li>截止日期：每月20号截止，21号开始可以生成上月薪资</li>
            <li>基本工资：取员工个人薪资或岗位薪资</li>
            <li>加班费计算：
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>工作日加班：时薪 x 1.5</li>
                <li>周末加班：时薪 x 2</li>
                <li>节假日加班：时薪 x 3</li>
              </ul>
            </li>
            <li>调休规则：月加班超过36小时的部分自动转调休</li>
            <li>调休优先级：节假日 &gt; 周末 &gt; 工作日（优先计薪）</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>生成配置</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                薪资月份 <span className="text-red-500">*</span>
              </label>
              <select
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                required
              >
                <option value="">请选择月份</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              {availableMonths.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  当前无可生成的月份（每月21号后可生成上月薪资）
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">部门筛选</label>
              <select
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                <option value="">全部部门</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">不选择则生成所有员工的薪资</p>
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
              <Button type="submit" disabled={loading || !formData.month}>
                {loading ? '生成中...' : '生成薪资记录'}
              </Button>
              <Link href="/dashboard/salary">
                <Button type="button" variant="outline">
                  取消
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
