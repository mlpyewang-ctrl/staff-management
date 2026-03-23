'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteLeaveApplication,
  getLeaveApplication,
  getLeaveDurationPreview,
  updateLeaveApplication,
} from '@/server/actions/leave'
import { getLeaveSessionLabel } from '@/lib/utils'

export default function LeaveEditPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [initial, setInitial] = useState<any | null>(null)
  const [leaveType, setLeaveType] = useState('ANNUAL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startSession, setStartSession] = useState<'AM' | 'PM'>('AM')
  const [endSession, setEndSession] = useState<'AM' | 'PM'>('PM')
  const [daysPreview, setDaysPreview] = useState<number>(0)

  const submitIntentRef = useRef<'save' | 'submit'>('save')

  const canOperate = !!session?.user?.id && session?.user?.id === initial?.userId && initial?.status === 'DRAFT'
  const isReadonly = !canOperate

  useEffect(() => {
    const load = async () => {
      const app = (await getLeaveApplication(id)) as any
      setInitial(app)

      if (app?.type) {
        setLeaveType(app.type)
      }
      if (app?.startDate) {
        setStartDate(new Date(app.startDate).toISOString().slice(0, 10))
      }
      if (app?.endDate) {
        setEndDate(new Date(app.endDate).toISOString().slice(0, 10))
      }
      if (app?.startSession === 'AM' || app?.startSession === 'PM') {
        setStartSession(app.startSession)
      } else if (app?.halfDaySession === 'AM' || app?.halfDaySession === 'PM') {
        setStartSession(app.halfDaySession)
      }

      if (app?.endSession === 'AM' || app?.endSession === 'PM') {
        setEndSession(app.endSession)
      } else if (app?.halfDaySession === 'AM' || app?.halfDaySession === 'PM') {
        setEndSession(app.halfDaySession)
      }
    }

    load()
  }, [id])

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

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canOperate) {
      setMessage({ type: 'error', text: '仅申请人本人可编辑草稿' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(event.currentTarget)
    formData.set('id', id)
    formData.set('action', submitIntentRef.current)
    formData.set('startSession', startSession)
    formData.set('endSession', endSession)

    const result = await updateLeaveApplication(formData)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    }

    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      router.push('/dashboard/leave')
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
    const result = await deleteLeaveApplication(id)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    }

    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      router.push('/dashboard/leave')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">编辑请假</h1>
          <p className="mt-1 text-gray-600">保存 / 提交 / 删除，提交后将进入审批流程。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>请假信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="type">假期类型</Label>
                <Select
                  id="type"
                  name="type"
                  required
                  disabled={isReadonly}
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value)}
                >
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
                      disabled={isReadonly}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startSession">开始时段</Label>
                    <Select
                      id="startSession"
                      name="startSession"
                      disabled={isReadonly}
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
                      disabled={isReadonly}
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
                      disabled={isReadonly}
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
              <Input
                id="destination"
                name="destination"
                type="text"
                disabled={isReadonly}
                defaultValue={initial?.destination ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{leaveType === 'COMPENSATORY' ? '调休事由' : '请假事由'}</Label>
              <Textarea
                id="reason"
                name="reason"
                rows={4}
                required
                disabled={isReadonly}
                defaultValue={initial?.reason ?? ''}
              />
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
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/leave">返回</Link>
              </Button>
            </div>
            {isReadonly && <div className="text-sm text-gray-500">仅申请人本人可编辑草稿；提交后需等待下一步审批或退回。</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
