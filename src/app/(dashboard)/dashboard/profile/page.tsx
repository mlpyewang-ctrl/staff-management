'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { getUserProfile, updateUserProfile } from '@/server/actions/user'
import { getDepartments } from '@/server/actions/department'

export default function ProfileDashboardPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<any | null>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | '' ; text: string }>({ type: '', text: '' })

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return
      const [p, depts] = await Promise.all([
        getUserProfile(session.user.id),
        getDepartments(),
      ])
      setProfile(p)
      setDepartments(depts)
    }
    load()
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return
    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(e.target as HTMLFormElement)
    const result = await updateUserProfile(session.user.id, formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
    }

    setLoading(false)
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">个人信息</h1>
        <p className="text-gray-600 mt-1">查看和维护您的基本资料</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={profile?.name || session.user.name || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || session.user.email || ''}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idCard">身份证号</Label>
                <Input
                  id="idCard"
                  name="idCard"
                  defaultValue={profile?.idCard || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">电话号码</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={profile?.phone || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">工作起始日期</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={
                    profile?.startDate
                      ? new Date(profile.startDate).toISOString().slice(0, 10)
                      : ''
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentId">部门</Label>
                <select
                  id="departmentId"
                  name="departmentId"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={profile?.departmentId || ''}
                >
                  <option value="">未分配</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              {(session.user.role === 'ADMIN' || session.user.role === 'MANAGER') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="salary">薪资</Label>
                    <Input
                      id="salary"
                      name="salary"
                      type="number"
                      step="0.01"
                      defaultValue={profile?.salary ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">职级</Label>
                    <Input
                      id="level"
                      name="level"
                      defaultValue={profile?.level || ''}
                    />
                  </div>
                </>
              )}
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存修改'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

