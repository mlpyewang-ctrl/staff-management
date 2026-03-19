'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { deleteOvertimeApplication, getOvertimeApplication, updateOvertimeApplication } from '@/server/actions/overtime'

export default function OvertimeEditPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [initial, setInitial] = useState<any | null>(null)
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  useEffect(() => {
    const load = async () => {
      const app = await getOvertimeApplication(id)
      setInitial(app)
    }
    load()
  }, [id])

  const canOperate = useMemo(() => !!session?.user?.id, [session?.user?.id])
  const isReadonly = ['COMPLETED', 'APPROVED'].includes(initial?.status || '')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canOperate) {
      setMessage({ type: 'error', text: '用户未登录' })
      return
    }
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('id', id)
    formData.set('action', submitIntentRef.current)

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
      setMessage({ type: 'error', text: '用户未登录' })
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">加班日期</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  disabled={isReadonly}
                  defaultValue={initial?.date ? new Date(initial.date).toISOString().slice(0, 10) : ''}
                />
              </div>
              <div className="space-y-2">
                <Label>时间范围</Label>
                <div className="flex space-x-2">
                  <Input
                    name="startTime"
                    type="time"
                    required
                    disabled={isReadonly}
                    className="flex-1"
                    defaultValue={
                      initial?.startTime ? new Date(initial.startTime).toISOString().slice(11, 16) : ''
                    }
                  />
                  <span className="text-gray-400">至</span>
                  <Input
                    name="endTime"
                    type="time"
                    required
                    disabled={isReadonly}
                    className="flex-1"
                    defaultValue={initial?.endTime ? new Date(initial.endTime).toISOString().slice(11, 16) : ''}
                  />
                </div>
              </div>
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
            {isReadonly && <div className="text-sm text-gray-500">该申请已完成，不可再修改。</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

