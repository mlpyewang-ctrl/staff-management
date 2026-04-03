'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getOvertimeApplication, submitOvertimeConfirmation } from '@/server/actions/overtime'
import { calculateHours } from '@/lib/utils'

type OvertimeApplicationDetail = Awaited<ReturnType<typeof getOvertimeApplication>>

export default function OvertimeConfirmPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [initial, setInitial] = useState<OvertimeApplicationDetail>(null)
  const [actualHours, setActualHours] = useState<number>(0)

  // 实际时间表单状态
  const [actualDate, setActualDate] = useState('')
  const [actualStartTime, setActualStartTime] = useState('')
  const [actualEndTime, setActualEndTime] = useState('')

  useEffect(() => {
    const load = async () => {
      const app = await getOvertimeApplication(id)
      if (!app || app.status !== 'PRE_APPROVED') {
        router.push('/dashboard/overtime')
        return
      }
      setInitial(app)
      // 初始化日期为申请日期
      setActualDate(new Date(app.date).toISOString().slice(0, 10))
    }
    load()
  }, [id, router])

  // 自动计算实际加班时长
  useEffect(() => {
    if (actualDate && actualStartTime && actualEndTime) {
      const start = new Date(`${actualDate} ${actualStartTime}`)
      const end = new Date(`${actualDate} ${actualEndTime}`)
      const hours = calculateHours(start, end)
      setActualHours(hours > 0 ? hours : 0)
    }
  }, [actualDate, actualStartTime, actualEndTime])

  const canSubmit = !!session?.user?.id && session?.user?.id === initial?.userId && initial?.status === 'PRE_APPROVED'

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) {
      setMessage({ type: 'error', text: '无权操作' })
      return
    }

    if (actualHours <= 0) {
      setMessage({ type: 'error', text: '结束时间必须晚于开始时间' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData()
    formData.set('id', id)
    formData.set('date', actualDate)
    formData.set('startTime', actualStartTime)
    formData.set('endTime', actualEndTime)

    const result = await submitOvertimeConfirmation(formData)
    if (result.error) setMessage({ type: 'error', text: result.error })
    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      router.push('/dashboard/overtime')
    }
    setLoading(false)
  }

  if (!initial) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">加班确认</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-slate-500">加载中...</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">加班确认</h1>
          <p className="text-gray-600 mt-1">事前审批已通过，请填写实际加班时间</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>原申请信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">申请日期：</span>
              <span>{new Date(initial.date).toLocaleDateString('zh-CN')}</span>
            </div>
            <div>
              <span className="text-gray-500">申请时长：</span>
              <span>{initial.hours} 小时</span>
            </div>
            <div>
              <span className="text-gray-500">申请时段：</span>
              <span>
                {new Date(initial.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                {new Date(initial.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-gray-500">加班类型：</span>
              <span>
                {initial.type === 'WEEKEND' ? '周末' : initial.type === 'HOLIDAY' ? '节假日' : '工作日'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">加班事由：</span>
              <span>{initial.reason}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>实际加班时间</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actualDate">实际加班日期</Label>
                <Input
                  id="actualDate"
                  name="date"
                  type="date"
                  required
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>实际时间范围</Label>
                <div className="flex space-x-2">
                  <Input
                    name="startTime"
                    type="time"
                    required
                    className="flex-1"
                    value={actualStartTime}
                    onChange={(e) => setActualStartTime(e.target.value)}
                  />
                  <span className="text-gray-400 self-center">至</span>
                  <Input
                    name="endTime"
                    type="time"
                    required
                    className="flex-1"
                    value={actualEndTime}
                    onChange={(e) => setActualEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>实际加班时长</Label>
                <div className="flex items-center h-10 px-3 bg-gray-50 rounded-md border">
                  <span className={`font-medium ${actualHours > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {actualHours > 0 ? `${actualHours} 小时` : '自动计算'}
                  </span>
                </div>
              </div>
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={loading || actualHours <= 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? '处理中...' : '提交确认'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/overtime')}>
                返回
              </Button>
            </div>
            {actualHours <= 0 && actualStartTime && actualEndTime && (
              <div className="text-sm text-amber-600">结束时间必须晚于开始时间</div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
