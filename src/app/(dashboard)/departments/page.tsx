'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getDepartments, createDepartment, updateDepartment } from '@/server/actions/department'

export default function DepartmentsPage() {
  const { data: session } = useSession()
  const [departments, setDepartments] = useState<any[]>([])
  const [editingDept, setEditingDept] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | '' ; text: string }>({ type: '', text: '' })

  useEffect(() => {
    const load = async () => {
      const depts = await getDepartments()
      setDepartments(depts)
    }
    load()
  }, [])

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">部门管理</h1>
        <p className="text-gray-600">仅管理员可以访问此页面。</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    const result = editingDept
      ? await updateDepartment(editingDept.id, formData)
      : await createDepartment(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      const depts = await getDepartments()
      setDepartments(depts)
      setEditingDept(null)
      ;(e.target as HTMLFormElement).reset()
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">部门管理</h1>
          <p className="text-gray-600 mt-1">维护系统中的部门信息</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingDept ? '编辑部门' : '新增部门'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">部门名称</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingDept?.name || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">部门编码</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingDept?.code || ''}
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
              {editingDept && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDept(null)}
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
          <CardTitle>部门列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>编码</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                    暂无部门
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>{dept.name}</TableCell>
                    <TableCell>{dept.code}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDept(dept)}
                      >
                        编辑
                      </Button>
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

