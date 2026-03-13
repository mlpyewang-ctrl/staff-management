'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createPerformanceReview, getPerformanceReviews, updatePerformanceReview } from '@/server/actions/performance'

export default function PerformancePage() {
  const { data: session } = useSession()
  const [showForm, setShowForm] = useState(false)
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

      // #region agent log
      fetch('http://127.0.0.1:7411/ingest/a123eedd-0d9e-424e-b565-89bc816ab6ab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '21ada3',
        },
        body: JSON.stringify({
          sessionId: '21ada3',
          runId: 'nav-debug',
          hypothesisId: 'H-buttons',
          location: 'src/app/(dashboard)/dashboard/performance/page.tsx:40',
          message: 'performance page loaded',
          data: {
            role: session.user?.role ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    formData.set('userId', session?.user?.id || '')
    formData.set('reviewerId', session?.user?.id || '')
    formData.set('quality', scores.quality.toString())
    formData.set('efficiency', scores.efficiency.toString())
    formData.set('attitude', scores.attitude.toString())
    formData.set('skill', scores.skill.toString())
    formData.set('teamwork', scores.teamwork.toString())

    const result = await createPerformanceReview(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      setShowForm(false)
      fetchReviews()
    }

    setLoading(false)
  }

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
        {(session?.user?.role === 'EMPLOYEE' || session?.user?.role === 'MANAGER') && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? '返回列表' : '填写绩效'}
          </Button>
        )}
      </div>

      {showForm && (session?.user?.role === 'EMPLOYEE' || session?.user?.role === 'MANAGER') && (
        <Card>
          <CardHeader>
            <CardTitle>填写绩效评估</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="period">绩效期间（例如 2024-Q1）</Label>
                <Input
                  id="period"
                  name="period"
                  type="text"
                  placeholder="例如 2024-Q1 或 2024-01"
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
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 分</span>
                      <span>5 分</span>
                    </div>
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
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 分</span>
                      <span>5 分</span>
                    </div>
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
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 分</span>
                      <span>5 分</span>
                    </div>
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
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 分</span>
                      <span>5 分</span>
                    </div>
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
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 分</span>
                      <span>5 分</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">平均分</div>
                <div className="text-2xl font-bold text-blue-700">{totalScore.toFixed(1)} 分</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">评价说明</Label>
                <Textarea
                  id="comment"
                  name="comment"
                  placeholder="请输入评价说明（可选）..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selfComment">绩效自评</Label>
                <Textarea
                  id="selfComment"
                  name="selfComment"
                  placeholder="请填写自我评价（可选）..."
                  rows={3}
                />
              </div>

              {message.text && (
                <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {message.text}
                </div>
              )}
              <div className="flex space-x-2">
                <Button type="submit" disabled={loading}>
                  {loading ? '提交中...' : '提交绩效'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
                {(session?.user?.role === 'EMPLOYEE' || session?.user?.role === 'MANAGER') && (
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
                    {(session?.user?.role === 'EMPLOYEE' || session?.user?.role === 'MANAGER') && (
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingReview(review)
                            setScores({
                              quality: review.quality,
                              efficiency: review.efficiency,
                              attitude: review.attitude,
                              skill: review.skill,
                              teamwork: review.teamwork,
                            })
                          }}
                        >
                          编辑
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
