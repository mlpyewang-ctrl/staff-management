'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createOvertimeApplication } from '@/server/actions/overtime'

export default function OvertimeNewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('userId', session?.user?.id || '')
    formData.set('action', submitIntentRef.current)

    const result = await createOvertimeApplication(formData)
    if (result.error) setMessage({ type: 'error', text: result.error })
    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      if (submitIntentRef.current === 'save' && (result as any).id) {
        router.push(`/dashboard/overtime/${(result as any).id}`)
      } else {
        router.push('/dashboard/overtime')
      }
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增加班</h1>
          <p className="text-gray-600 mt-1">保存为草稿或提交进入审批</p>
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
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>时间范围</Label>
                <div className="flex space-x-2">
                  <Input name="startTime" type="time" required className="flex-1" />
                  <span className="text-gray-400">至</span>
                  <Input name="endTime" type="time" required className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">加班类型</Label>
                <select
                  id="type"
                  name="type"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue="WORKDAY"
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
              <Textarea id="reason" name="reason" rows={4} required />
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
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/overtime')}>
                返回
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

