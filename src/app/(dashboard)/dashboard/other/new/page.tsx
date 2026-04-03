'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { WordUploadField } from '@/components/word-upload-field'
import { createOtherApplication } from '@/server/actions/otherApplication'

type CreateOtherApplicationResult = Awaited<ReturnType<typeof createOtherApplication>>

const typePlaceholders: Record<string, { title: string; content: string }> = {
  RESIGNATION_HANDOVER: {
    title: '请输入离职交接标题，如：离职交接申请-张三',
    content: '请详细描述离职交接内容，包括：\n1. 离职原因\n2. 工作交接清单\n3. 交接对象\n4. 预计离职日期\n5. 其他需要说明的事项',
  },
  RESUME_UPDATE: {
    title: '请输入履历更新标题，如：个人履历更新申请',
    content: '请详细描述需要更新的履历内容，包括：\n1. 更新项目（学历、工作经历、技能证书等）\n2. 更新前的信息\n3. 更新后的信息\n4. 更新原因\n5. 相关证明材料说明',
  },
  PARTY_INFO_UPDATE: {
    title: '请输入党员信息更新标题，如：党员信息变更申请',
    content: '请详细描述需要更新的党员信息，包括：\n1. 更新项目（党组织关系、党内职务、联系方式等）\n2. 更新前的信息\n3. 更新后的信息\n4. 更新原因\n5. 相关证明材料说明',
  },
}

export default function OtherNewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [applicationType, setApplicationType] = useState('RESIGNATION_HANDOVER')
  const submitIntentRef = useRef<'save' | 'submit'>('save')

  const placeholder = typePlaceholders[applicationType]

  const submit = async (action: 'save' | 'submit', e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.currentTarget)
    formData.set('userId', session?.user?.id || '')
    formData.set('action', action)

    const result: CreateOtherApplicationResult = await createOtherApplication(formData)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    }

    if (result.success) {
      setMessage({ type: 'success', text: result.success })
      if (action === 'save' && 'id' in result && result.id) {
        router.push(`/dashboard/other/${result.id}`)
      } else {
        router.push('/dashboard/other')
      }
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增其他事项申请</h1>
          <p className="mt-1 text-gray-600">选择事项类型并填写相关信息。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申请信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => submit(submitIntentRef.current, event)}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">事项类型</Label>
                <Select
                  id="type"
                  name="type"
                  required
                  value={applicationType}
                  onChange={(event) => setApplicationType(event.target.value)}
                >
                  <option value="RESIGNATION_HANDOVER">离职交接</option>
                  <option value="RESUME_UPDATE">履历更新</option>
                  <option value="PARTY_INFO_UPDATE">党员信息更新</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">申请标题</Label>
              <Input
                id="title"
                name="title"
                type="text"
                required
                placeholder={placeholder.title}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">申请内容</Label>
              <Textarea
                id="content"
                name="content"
                rows={10}
                required
                placeholder={placeholder.content}
              />
            </div>

            {(applicationType === 'RESUME_UPDATE' || applicationType === 'PARTY_INFO_UPDATE') && (
              <div className="space-y-4 rounded-md border border-gray-200 p-4">
                <div className="text-sm font-medium text-gray-900">附件材料</div>
                <div className="flex items-center gap-2">
                  <a
                    href={applicationType === 'RESUME_UPDATE' ? '/templates/resume_template.docx' : '/templates/party_info_template.docx'}
                    download
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    下载参考模板
                  </a>
                </div>
                <WordUploadField />
              </div>
            )}

            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              <p>提示：</p>
              <ul className="ml-4 mt-1 list-disc">
                <li>请根据选择的事项类型填写相应的内容</li>
                <li>内容至少需要 10 个字符</li>
                <li>保存后可在列表中编辑，提交后进入审批流程</li>
              </ul>
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
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/other')}>
                返回
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
