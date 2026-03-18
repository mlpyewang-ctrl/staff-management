'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { createLeaveApplication } from '@/server/actions/leave'

export default function LeaveNewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  const submit = async (action: 'save' | 'submit', e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('userId', session?.user?.id || '')
    formData.set('action', action)

    const result = await createLeaveApplication(formData)
    if (result.error) setMessage({ type: 'error', text: result.error })
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增请假</h1>
          <p className="text-gray-600 mt-1">保存为草稿或提交进入审批</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>请假信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => submit(submitIntentRef.current, e)}>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">假期类型</Label>
                <Select id="type" name="type" required>
                  <option value="ANNUAL">年假</option>
                  <option value="SICK">病假</option>
                  <option value="PERSONAL">事假</option>
                  <option value="MARRIAGE">婚假</option>
                  <option value="MATERNITY">产假</option>
                  <option value="PATERNITY">陪产假</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>请假时间</Label>
                <div className="flex space-x-2">
                  <Input name="startDate" type="date" required className="flex-1" />
                  <span className="text-gray-400">至</span>
                  <Input name="endDate" type="date" required className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">前往地点</Label>
                <Input id="destination" name="destination" type="text" placeholder="可选" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">请假事由</Label>
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

