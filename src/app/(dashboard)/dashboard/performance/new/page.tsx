'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createPerformanceReview } from '@/server/actions/performance'

type CreatePerformanceReviewResult = Awaited<ReturnType<typeof createPerformanceReview>>

export default function PerformanceNewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  const [scores, setScores] = useState({
    quality: 3,
    efficiency: 3,
    attitude: 3,
    skill: 3,
    teamwork: 3,
  })

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('userId', session?.user?.id || '')
    formData.set('reviewerId', session?.user?.id || '')
    formData.set('quality', scores.quality.toString())
    formData.set('efficiency', scores.efficiency.toString())
    formData.set('attitude', scores.attitude.toString())
    formData.set('skill', scores.skill.toString())
    formData.set('teamwork', scores.teamwork.toString())
    formData.set('action', submitIntentRef.current)

    const result: CreatePerformanceReviewResult = await createPerformanceReview(formData)
    if (result.error) setMessage({ type: 'error', text: result.error })
    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      if (submitIntentRef.current === 'save' && 'id' in result && result.id) {
        router.push(`/dashboard/performance/${result.id}`)
      } else {
        router.push('/dashboard/performance')
      }
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
          <h1 className="text-2xl font-bold text-gray-900">新增绩效</h1>
          <p className="text-gray-600 mt-1">保存为草稿或提交进入审批</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>绩效信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="period">绩效期间（例如 2024-Q1）</Label>
              <Input id="period" name="period" type="text" required placeholder="例如 2024-Q1 或 2024-01" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['quality', '工作质量'],
                  ['efficiency', '工作效率'],
                  ['attitude', '工作态度'],
                  ['skill', '专业技能'],
                  ['teamwork', '团队协作'],
                ] as const
              ).map(([key, label]) => (
                <div className="space-y-2" key={key}>
                  <Label>
                    {label} ({scores[key]}分)
                  </Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={scores[key]}
                    onChange={(e) => setScores({ ...scores, [key]: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">平均分</div>
              <div className="text-2xl font-bold text-blue-700">{totalScore.toFixed(1)} 分</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">评价说明</Label>
              <Textarea id="comment" name="comment" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selfComment">绩效自评</Label>
              <Textarea id="selfComment" name="selfComment" rows={3} />
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={loading}
                onClick={() => {
                  submitIntentRef.current = 'save'
                }}
              >
                {loading ? '处理中...' : '保存'}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  submitIntentRef.current = 'submit'
                }}
              >
                提交
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/performance')}>
                返回
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

