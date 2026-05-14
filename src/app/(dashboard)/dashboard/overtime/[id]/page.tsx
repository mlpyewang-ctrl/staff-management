'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { deleteOvertimeApplication, getOvertimeApplication, updateOvertimeApplication } from '@/server/actions/overtime'
import { calculateHours } from '@/lib/utils'

type OvertimeApplicationDetail = Awaited<ReturnType<typeof getOvertimeApplication>>

function formatDateInput(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeInput(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

export default function OvertimeEditPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [initial, setInitial] = useState<OvertimeApplicationDetail>(null)
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hours, setHours] = useState(0)

  useEffect(() => {
    const load = async () => {
      const app = await getOvertimeApplication(id)
      setInitial(app)
      if (app) {
        setStartDate(formatDateInput(app.startTime))
        setStartTime(formatTimeInput(app.startTime))
        setEndDate(formatDateInput(app.endTime))
        setEndTime(formatTimeInput(app.endTime))
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (startDate && startTime && endDate && endTime) {
      const start = new Date(`${startDate} ${startTime}`)
      const end = new Date(`${endDate} ${endTime}`)
      const h = calculateHours(start, end)
      setHours(h > 0 ? h : 0)
    } else {
      setHours(0)
    }
  }, [startDate, startTime, endDate, endTime])

  const canOperate = useMemo(
    () => !!session?.user?.id && session?.user?.id === initial?.userId && initial?.status === 'DRAFT',
    [initial?.status, initial?.userId, session?.user?.id]
  )
  const isReadonly = !canOperate

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canOperate) {
      setMessage({ type: 'error', text: '仅申请人本人可编辑草稿' })
      return
    }
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('id', id)
    formData.set('action', submitIntentRef.current)
    formData.set('startDate', startDate)
    formData.set('startTime', startTime)
    formData.set('endDate', endDate)
    formData.set('endTime', endTime)

    const result = await updateOvertimeApplication(formData)
    if (result.error) setMessage({ type: 'error', text: result.error })
    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      router.push('/dashboard/overtime')
    }
    setLoading(false)
  }

  const onDelete = async () => {
    if (!canOperate) {
      setMessage({ type: 'error', text: '仅申请人本人可删除草稿' })
      return
    }
    setLoading(true)
    setMessage({ type: '', text: '' })
    const result = await deleteOvertimeApplication(id)
    if (result.error) setMessage({ type: 'error', text: result.error })
    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      router.push('/dashboard/overtime')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">编辑加班</h1>
          <p className="text-gray-600 mt-1">保存/提交/删除（提交后进入审批流程）</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>加班信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">开始日期</Label>
                <DatePicker
                  id="startDate"
                  value={startDate}
                  onChange={setStartDate}
                  disabled={isReadonly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">开始时间</Label>
                <TimePicker
                  id="startTime"
                  value={startTime}
                  onChange={setStartTime}
                  disabled={isReadonly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">结束日期</Label>
                <DatePicker
                  id="endDate"
                  value={endDate}
                  onChange={setEndDate}
                  disabled={isReadonly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">结束时间</Label>
                <TimePicker
                  id="endTime"
                  value={endTime}
                  onChange={setEndTime}
                  disabled={isReadonly}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">加班类型</Label>
                <select
                  id="type"
                  name="type"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={initial?.type ?? 'WORKDAY'}
                  disabled={isReadonly}
                  required
                >
                  <option value="WORKDAY">工作日</option>
                  <option value="WEEKEND">周末</option>
                  <option value="HOLIDAY">节假日</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>预计加班时长</Label>
                <div className="flex items-center h-10 px-3 bg-gray-50 rounded-md border">
                  <span className={`font-medium ${hours > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {hours > 0 ? `${hours} 小时` : '自动计算'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">加班事由</Label>
              <Textarea
                id="reason"
                name="reason"
                rows={4}
                required
                disabled={isReadonly}
                defaultValue={initial?.reason ?? ''}
              />
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex space-x-2">
              {!isReadonly && (
                <>
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
                  <Button type="button" variant="destructive" disabled={loading} onClick={onDelete}>
                    删除
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/overtime')}>
                返回
              </Button>
            </div>
            {isReadonly && <div className="text-sm text-gray-500">仅申请人本人可编辑草稿；已提交后需等待下一岗审核或退回。</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
