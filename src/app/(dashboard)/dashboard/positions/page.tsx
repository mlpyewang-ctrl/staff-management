'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getPositions, createPosition, updatePosition, deletePosition } from '@/server/actions/position'
import { getDepartments } from '@/server/actions/department'

type PositionItem = Awaited<ReturnType<typeof getPositions>>[number]

interface DepartmentOption {
  id: string
  name: string
}

export default function PositionsDashboardPage() {
  const { data: session } = useSession()
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [editingPosition, setEditingPosition] = useState<PositionItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })

  useEffect(() => {
    const load = async () => {
      const [data, deptData] = await Promise.all([getPositions(), getDepartments()])
      setPositions(data)
      setDepartments(deptData)
    }
    load()
  }, [])

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">岗位管理</h1>
        <p className="text-gray-600">仅管理员可以访问此页面。</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    const result = editingPosition
      ? await updatePosition(editingPosition.id, formData)
      : await createPosition(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      const data = await getPositions()
      setPositions(data)
      setEditingPosition(null)
      ;(e.target as HTMLFormElement).reset()
    }

    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此岗位吗？')) return

    const result = await deletePosition(id)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      const data = await getPositions()
      setPositions(data)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">岗位管理</h1>
          <p className="text-gray-600 mt-1">维护系统中的岗位薪酬配置</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingPosition ? '编辑岗位' : '新增岗位'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">岗位名称</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingPosition?.name || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentId">所属部门</Label>
                <select
                  id="departmentId"
                  name="departmentId"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={editingPosition?.departmentId || ''}
                  required
                >
                  <option value="">请选择部门</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseSalary">基础工资</Label>
                <Input
                  id="baseSalary"
                  name="baseSalary"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingPosition?.baseSalary || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hasSeniorityPay">是否有工龄工资</Label>
                <select
                  id="hasSeniorityPay"
                  name="hasSeniorityPay"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={editingPosition?.hasSeniorityPay === false ? 'false' : 'true'}
                >
                  <option value="true">有</option>
                  <option value="false">无</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seniorityPayPerYear">工龄工资（每年）</Label>
                <Input
                  id="seniorityPayPerYear"
                  name="seniorityPayPerYear"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingPosition?.seniorityPayPerYear || '100'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxSeniorityPay">工龄工资上限</Label>
                <Input
                  id="maxSeniorityPay"
                  name="maxSeniorityPay"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingPosition?.maxSeniorityPay || '1000'}
                  required
                />
              </div>
            </div>
            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}
            <div className="flex space-x-2">
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
              {editingPosition && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPosition(null)
                    setMessage({ type: '', text: '' })
                  }}
                >
                  取消编辑
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>岗位列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>岗位名称</TableHead>
                <TableHead>所属部门</TableHead>
                <TableHead>基础工资</TableHead>
                <TableHead>工龄工资</TableHead>
                <TableHead>每年涨幅</TableHead>
                <TableHead>工龄上限</TableHead>
                <TableHead>关联员工数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    暂无岗位
                  </TableCell>
                </TableRow>
              ) : (
                positions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell>{pos.name}</TableCell>
                    <TableCell>{pos.department?.name || '-'}</TableCell>
                    <TableCell>{pos.baseSalary?.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</TableCell>
                    <TableCell>{pos.hasSeniorityPay ? '有' : '无'}</TableCell>
                    <TableCell>{pos.seniorityPayPerYear?.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</TableCell>
                    <TableCell>{pos.maxSeniorityPay?.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</TableCell>
                    <TableCell>{pos._count?.users || 0}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPosition(pos)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(pos.id)}
                        >
                          删除
                        </Button>
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
