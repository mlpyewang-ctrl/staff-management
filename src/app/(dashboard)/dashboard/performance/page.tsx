'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getPerformanceReviews, updatePerformanceReview } from '@/server/actions/performance'

export default function PerformancePage() {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [editingReview, setEditingReview] = useState<any | null>(null)
  const [scores, setScores] = useState({
    quality: 3,
    efficiency: 3,
    attitude: 3,
    skill: 3,
    teamwork: 3,
  })

  const canCreate = !!session?.user?.id
  const canEdit = !!session?.user?.id

  const fetchReviews = async () => {
    const data = await getPerformanceReviews(
      session?.user?.id,
      session?.user?.role
    )
    setReviews(data)
  }

  useEffect(() => {
    if (session) {
      fetchReviews()

    }
  }, [session])

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReview) return
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    formData.set('id', editingReview.id)
    formData.set('quality', scores.quality.toString())
    formData.set('efficiency', scores.efficiency.toString())
    formData.set('attitude', scores.attitude.toString())
    formData.set('skill', scores.skill.toString())
    formData.set('teamwork', scores.teamwork.toString())

    const result = await updatePerformanceReview(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      setEditingReview(null)
      fetchReviews()
    }

    setLoading(false)
  }

  const totalScore = (
    scores.quality + scores.efficiency + scores.attitude + scores.skill + scores.teamwork
  ) / 5

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">绩效管理</h1>
          <p className="text-gray-600 mt-1">填写和查看绩效评估记录</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/performance/new">新增</Link>
          </Button>
        )}
      </div>

      {/* moved to /dashboard/performance/new */}

      <Card>
        <CardHeader>
          <CardTitle>绩效记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>期间</TableHead>
                {session?.user?.role !== 'EMPLOYEE' && <TableHead>员工</TableHead>}
                <TableHead>工作质量</TableHead>
                <TableHead>工作效率</TableHead>
                <TableHead>工作态度</TableHead>
                <TableHead>专业技能</TableHead>
                <TableHead>团队协作</TableHead>
                <TableHead>平均分</TableHead>
                <TableHead>评价</TableHead>
                <TableHead>自评</TableHead>
                {canEdit && (
                  <TableHead>操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    暂无绩效记录
                  </TableCell>
                </TableRow>
              ) : (
                reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>{review.period}</TableCell>
                    {session?.user?.role !== 'EMPLOYEE' && (
                      <TableCell>{review.userName}</TableCell>
                    )}
                    <TableCell>{review.quality}</TableCell>
                    <TableCell>{review.efficiency}</TableCell>
                    <TableCell>{review.attitude}</TableCell>
                    <TableCell>{review.skill}</TableCell>
                    <TableCell>{review.teamwork}</TableCell>
                    <TableCell>
                      <Badge variant={review.totalScore >= 4 ? 'success' : review.totalScore >= 3 ? 'default' : 'warning'}>
                        {review.totalScore.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{review.comment || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{review.selfComment || '-'}</TableCell>
                {canEdit && (
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                      asChild
                        >
                      <Link href={`/dashboard/performance/${review.id}`}>编辑</Link>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingReview && (
        <Card>
          <CardHeader>
            <CardTitle>编辑绩效记录</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-period">绩效期间（例如 2024-Q1）</Label>
                <Input
                  id="edit-period"
                  name="period"
                  type="text"
                  defaultValue={editingReview.period}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>工作质量 ({scores.quality}分)</Label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={scores.quality}
                      onChange={(e) => setScores({ ...scores, quality: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>工作效率 ({scores.efficiency}分)</Label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={scores.efficiency}
                      onChange={(e) => setScores({ ...scores, efficiency: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>工作态度 ({scores.attitude}分)</Label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={scores.attitude}
                      onChange={(e) => setScores({ ...scores, attitude: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>专业技能 ({scores.skill}分)</Label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={scores.skill}
                      onChange={(e) => setScores({ ...scores, skill: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>团队协作 ({scores.teamwork}分)</Label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={scores.teamwork}
                      onChange={(e) => setScores({ ...scores, teamwork: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-comment">评价说明</Label>
                <Textarea
                  id="edit-comment"
                  name="comment"
                  rows={3}
                  defaultValue={editingReview.comment || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-selfComment">绩效自评</Label>
                <Textarea
                  id="edit-selfComment"
                  name="selfComment"
                  rows={3}
                  defaultValue={editingReview.selfComment || ''}
                />
              </div>
              {message.text && (
                <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {message.text}
                </div>
              )}
              <div className="flex space-x-2">
                <Button type="submit" disabled={loading}>
                  {loading ? '保存中...' : '保存修改'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingReview(null)}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
