'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  deleteLeaveApplication,
  getLeaveApplication,
  getLeaveDurationPreview,
  updateLeaveApplication,
} from '@/server/actions/leave'

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
  const [daysPreview, setDaysPreview] = useState<number>(0)

  const submitIntentRef = useRef<'save' | 'submit'>('save')

  useEffect(() => {
    const load = async () => {
      const app = await getLeaveApplication(id)
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
    }
    load()
  }, [id])

  useEffect(() => {
    const loadPreview = async () => {
      if (!startDate || !endDate) {
        setDaysPreview(0)
        return
      }

      const result = await getLeaveDurationPreview(startDate, endDate)
      setDaysPreview(result.days)
    }

    loadPreview()
  }, [startDate, endDate])

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

    const result = await updateLeaveApplication(formData)
    if (result.error) setMessage({ type: 'error', text: result.error })
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
    if (result.error) setMessage({ type: 'error', text: result.error })
    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      router.push('/dashboard/leave')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">编辑请假</h1>
          <p className="text-gray-600 mt-1">保存/提交/删除（提交后进入审批流程）</p>
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
                  onChange={(e) => setLeaveType(e.target.value)}
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
              <div className="space-y-2">
                <Label htmlFor="startDate">开始日期</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  disabled={isReadonly}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
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
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>自动计算天数</Label>
                <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                  {daysPreview > 0 ? `${daysPreview} 天` : '选择日期后自动计算'}
                </div>
              </div>
            </div>

            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              计算规则：按工作日自动计算，请假最小 0.5 天；周末和法定节假日不计入请假天数。
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
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/leave')}>
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

