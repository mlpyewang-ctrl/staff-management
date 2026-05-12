'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useAsyncAction } from '@/lib/use-async-action'
import { getDepartments, createDepartment, updateDepartment } from '@/server/actions/department'

type DepartmentItem = Awaited<ReturnType<typeof getDepartments>>[number]

export default function DepartmentsDashboardPage() {
  const { data: session } = useSession()
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | '' ; text: string }>({ type: '', text: '' })

  useEffect(() => {
    const load = async () => {
      setPageLoading(true)
      const depts = await getDepartments()
      setDepartments(depts)
      setPageLoading(false)
    }
    load()
  }, [])

  const { loading: submitLoading, execute: executeSubmit } = useAsyncAction(async (e: React.FormEvent) => {
    setMessage({ type: '', text: '' })
    const formData = new FormData(e.currentTarget as HTMLFormElement)
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
      ;(e.currentTarget as HTMLFormElement).reset()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeSubmit(e)
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">部门管理</h1>
        <p className="text-gray-600">仅管理员可以访问此页面。</p>
      </div>
    )
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
              <Button type="submit" loading={submitLoading}>
                保存
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
          {pageLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <LoadingSpinner size="md" />
              <span>正在加载部门数据...</span>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
