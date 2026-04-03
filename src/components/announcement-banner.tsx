'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
// 使用 emoji 作为图标
import { Button } from '@/components/ui/button'
import { getActiveAnnouncement, type Announcement } from '@/server/actions/announcement'

export function AnnouncementBanner() {
  const { data: session } = useSession()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    const loadAnnouncement = async () => {
      try {
        const data = await getActiveAnnouncement()
        setAnnouncement(data)
      } catch {
        // 静默处理错误
      } finally {
        setLoading(false)
      }
    }
    loadAnnouncement()
  }, [])

  // 如果已关闭或加载中或无公告，不显示
  if (dismissed || loading || !announcement) {
    return null
  }

  return (
    <div className="relative mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* 图标 */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          📢
        </div>

        {/* 内容区域 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-amber-900">
              {announcement.title}
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              公示
            </span>
          </div>
          
          {/* 富文本内容 */}
          <div
            className="announcement-content mt-2 text-sm leading-relaxed text-amber-800 [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_td]:border [&_td]:border-amber-200 [&_td]:p-2 [&_th]:border [&_th]:border-amber-200 [&_th]:p-2 [&_th]:bg-amber-100"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />
          
          <div className="mt-2 text-xs text-amber-600">
            更新时间：{new Date(announcement.updatedAt).toLocaleDateString('zh-CN')}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
            >
              <Link href="/dashboard/announcements">
                ✏️
                编辑
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 text-amber-600 hover:bg-amber-100 hover:text-amber-900"
          >
            ✕
          </Button>
        </div>
      </div>
    </div>
  )
}
