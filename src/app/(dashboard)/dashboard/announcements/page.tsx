'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { RichTextEditor } from '@/components/rich-text-editor'
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  type Announcement,
  type AnnouncementInput,
} from '@/server/actions/announcement'

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<AnnouncementInput>({
    title: '',
    content: '',
    isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 检查权限
  useEffect(() => {
    if (session?.user && session.user.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, router])

  // 加载公示列表
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAnnouncements()
        setAnnouncements(data)
      } catch {
        // 错误处理
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')

    const result = editingId
      ? await updateAnnouncement(editingId, formData)
      : await createAnnouncement(formData)

    if (result.success) {
      // 重新加载数据
      const data = await getAnnouncements()
      setAnnouncements(data)
      // 重置表单
      setFormData({ title: '', content: '', isActive: true })
      setEditingId(null)
    } else {
      setError(result.error || '保存失败')
    }

    setSaving(false)
  }

  const handleEdit = (item: Announcement) => {
    setEditingId(item.id)
    setFormData({
      title: item.title,
      content: item.content,
      isActive: item.isActive,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条公示吗？')) return

    const result = await deleteAnnouncement(id)
    if (result.success) {
      setAnnouncements(announcements.filter((a) => a.id !== id))
    } else {
      alert(result.error || '删除失败')
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const result = await toggleAnnouncementStatus(id, !currentStatus)
    if (result.success) {
      const data = await getAnnouncements()
      setAnnouncements(data)
    } else {
      alert(result.error || '操作失败')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ title: '', content: '', isActive: true })
    setError('')
  }

  // 获取当前生效的公示
  const activeAnnouncement = announcements.find(a => a.isActive)

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="text-center text-slate-500">
          <p className="text-lg">无权访问</p>
          <p className="mt-2 text-sm">您没有权限访问此页面</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">返回仪表盘</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">公示管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            只有一个公示可以同时生效显示在仪表盘
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">返回仪表盘</Link>
        </Button>
      </div>

      {/* 当前生效公示提示 */}
      {activeAnnouncement && !editingId && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-sm text-green-800">
              当前生效公示：<strong>{activeAnnouncement.title}</strong>
            </span>
          </div>
        </div>
      )}

      {/* 编辑表单 */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? '编辑公示' : '新建公示'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">
              标题 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="请输入公示标题"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>
              内容 <span className="text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-slate-500">
                支持富文本，可插入表格
              </span>
            </Label>
            <RichTextEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder="请输入公示内容，点击工具栏表格按钮可插入表格..."
              height="350px"
            />
          </div>

          {/* 显示开关 */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-sm font-medium">
                在仪表盘显示
              </Label>
              <p className="text-xs text-slate-500">
                {formData.isActive 
                  ? '开启后将在仪表盘顶部显示此公示' 
                  : '开启后此公示将替换当前生效的公示'}
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : editingId ? '更新公示' : '创建公示'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={handleCancel}>
                取消编辑
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 公示列表 */}
      <Card>
        <CardHeader>
          <CardTitle>历史公示</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">加载中...</div>
          ) : announcements.length === 0 ? (
            <div className="py-8 text-center text-slate-500">暂无公示</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {announcements.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">
                        {item.title}
                      </h3>
                      {item.isActive && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          生效中
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      更新于 {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <Switch
                      checked={item.isActive}
                      onCheckedChange={() => handleToggleStatus(item.id, item.isActive)}
                      title={item.isActive ? '点击取消显示' : '点击生效显示'}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDelete(item.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
