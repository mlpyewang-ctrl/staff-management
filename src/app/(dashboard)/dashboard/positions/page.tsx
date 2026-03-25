'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getPositions, createPosition, updatePosition, deletePosition } from '@/server/actions/position'

type PositionItem = Awaited<ReturnType<typeof getPositions>>[number]

export default function PositionsDashboardPage() {
  const { data: session } = useSession()
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [editingPosition, setEditingPosition] = useState<PositionItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })

  useEffect(() => {
    const load = async () => {
      const data = await getPositions()
      setPositions(data)
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
            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="salary">基础薪资</Label>
                <Input
                  id="salary"
                  name="salary"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingPosition?.salary || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">职级</Label>
                <Input
                  id="level"
                  name="level"
                  defaultValue={editingPosition?.level || ''}
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
                <TableHead>基础薪资</TableHead>
                <TableHead>职级</TableHead>
                <TableHead>关联员工数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    暂无岗位
                  </TableCell>
                </TableRow>
              ) : (
                positions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell>{pos.name}</TableCell>
                    <TableCell>{pos.salary?.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</TableCell>
                    <TableCell>{pos.level || '-'}</TableCell>
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
