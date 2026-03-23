'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createLeaveApplication, getLeaveDurationPreview } from '@/server/actions/leave'
import { getLeaveSessionLabel } from '@/lib/utils'

export default function LeaveNewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [leaveType, setLeaveType] = useState('ANNUAL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startSession, setStartSession] = useState<'AM' | 'PM'>('AM')
  const [endSession, setEndSession] = useState<'AM' | 'PM'>('PM')
  const [daysPreview, setDaysPreview] = useState<number>(0)
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  useEffect(() => {
    const loadPreview = async () => {
      if (!startDate || !endDate) {
        setDaysPreview(0)
        return
      }

      const result = await getLeaveDurationPreview(startDate, endDate, startSession, endSession)
      setDaysPreview(result.days)
    }

    loadPreview()
  }, [startDate, endDate, startSession, endSession])

  const submit = async (action: 'save' | 'submit', e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('userId', session?.user?.id || '')
    formData.set('action', action)
    formData.set('startSession', startSession)
    formData.set('endSession', endSession)

    const result = await createLeaveApplication(formData)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    }

    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      if (action === 'save' && (result as any).id) {
        router.push(`/dashboard/leave/${(result as any).id}`)
      } else {
        router.push('/dashboard/leave')
      }
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增请假</h1>
          <p className="mt-1 text-gray-600">调休作为一种假种统一处理，并走请假审批流程。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>请假信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => submit(submitIntentRef.current, event)}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="type">假期类型</Label>
                <Select id="type" name="type" required value={leaveType} onChange={(event) => setLeaveType(event.target.value)}>
                  <option value="ANNUAL">年假</option>
                  <option value="SICK">病假</option>
                  <option value="PERSONAL">事假</option>
                  <option value="MARRIAGE">婚假</option>
                  <option value="MATERNITY">产假</option>
                  <option value="PATERNITY">陪产假</option>
                  <option value="COMPENSATORY">调休</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div className="text-sm font-medium text-gray-700">开始信息</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">开始日期</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      required
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startSession">开始时段</Label>
                    <Select
                      id="startSession"
                      name="startSession"
                      value={startSession}
                      onChange={(event) => setStartSession(event.target.value as 'AM' | 'PM')}
                    >
                      <option value="AM">上午</option>
                      <option value="PM">下午</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div className="text-sm font-medium text-gray-700">结束信息</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <div className="space-y-2">
                    <Label htmlFor="endDate">结束日期</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      required
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endSession">结束时段</Label>
                    <Select
                      id="endSession"
                      name="endSession"
                      value={endSession}
                      onChange={(event) => setEndSession(event.target.value as 'AM' | 'PM')}
                    >
                      <option value="AM">上午</option>
                      <option value="PM">下午</option>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              计算规则：按工作日自动计算，请假最少 0.5 天；周末和法定节假日不计入请假天数。
              {` 当前选择：${getLeaveSessionLabel(startSession)} → ${getLeaveSessionLabel(endSession)}`}
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">前往地点</Label>
              <Input id="destination" name="destination" type="text" placeholder="可选" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{leaveType === 'COMPENSATORY' ? '调休事由' : '请假事由'}</Label>
              <Textarea id="reason" name="reason" rows={4} required />
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              预计天数：{daysPreview > 0 ? `${daysPreview} 天` : '请选择日期后自动计算'}
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
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/leave')}>
                返回
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
