'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  calculateAnnualLeaveEntitlement,
  calculateCompletedYears,
  calculateSeniorityPay,
  formatDateInputValue,
} from '@/lib/seniority'
import { Button } from '@/components/ui/button'
import { parseAttachment } from '@/lib/attachment'
import { WordPreview } from '@/components/word-preview'
import { getUserProfile, updateUserProfile } from '@/server/actions/user'

interface UserProfile {
  id: string
  email: string
  name: string
  idCard?: string | null
  phone?: string | null
  salary?: number | null
  level?: string | null
  startDate?: string | Date | null
  seniorityStartDate?: string | Date | null
  seniorityEndDate?: string | Date | null
  resumeDoc?: string | null
  partyInfoDoc?: string | null
  department?: {
    name: string
  } | null
  position?: {
    name: string
    salary?: number | null
    level?: string | null
  } | null
}

export default function ProfileDashboardPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return
      const userProfile = await getUserProfile(session.user.id)
      setProfile(userProfile)
    }

    load()
  }, [session])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session?.user?.id) return

    setLoading(true)
    setMessage({ type: '', text: '' })

    const formData = new FormData(event.currentTarget)
    const result = await updateUserProfile(session.user.id, formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      const userProfile = await getUserProfile(session.user.id)
      setProfile(userProfile)
    }

    setLoading(false)
  }

  if (!session) {
    return null
  }

  const baseSalaryValue = profile?.position?.salary ?? profile?.salary ?? null
  const salaryText =
    baseSalaryValue !== null
      ? baseSalaryValue.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
      : '未设置'
  const seniorityPay = calculateSeniorityPay(profile?.startDate)
  const seniorityPayText = seniorityPay.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
  const totalSalaryText =
    baseSalaryValue !== null
      ? (baseSalaryValue + seniorityPay).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
      : '未设置'

  const levelText = profile?.level || profile?.position?.level || '未设置'
  const employmentYears = calculateCompletedYears(profile?.startDate)
  const annualLeaveYears = calculateCompletedYears(profile?.seniorityStartDate, profile?.seniorityEndDate)
  const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(
    profile?.seniorityStartDate,
    profile?.seniorityEndDate
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">个人信息</h1>
        <p className="mt-1 text-gray-600">查看和维护您的基础资料</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        部门、岗位、职级、入职日期和工龄信息由管理员在“人员岗位”模块统一维护，个人页面只展示结果。
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" name="name" defaultValue={profile?.name || session.user.name || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" type="email" value={profile?.email || session.user.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idCard">身份证号</Label>
                <Input id="idCard" name="idCard" defaultValue={profile?.idCard || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">电话号码</Label>
                <Input id="phone" name="phone" defaultValue={profile?.phone || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">入职日期</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={formatDateInputValue(profile?.startDate)}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seniorityStartDate">工龄起始日期</Label>
                <Input
                  id="seniorityStartDate"
                  name="seniorityStartDate"
                  type="date"
                  defaultValue={formatDateInputValue(profile?.seniorityStartDate)}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seniorityEndDate">工龄截止日期</Label>
                <Input
                  id="seniorityEndDate"
                  name="seniorityEndDate"
                  type="date"
                  defaultValue={formatDateInputValue(profile?.seniorityEndDate)}
                  disabled
                />
                <p className="text-xs text-gray-500">由管理员在人员岗位页面维护</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentDisplay">部门</Label>
                <Input id="departmentDisplay" value={profile?.department?.name || '未分配'} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positionDisplay">岗位</Label>
                <Input id="positionDisplay" value={profile?.position?.name || '未设置'} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="levelDisplay">职级</Label>
                <Input id="levelDisplay" value={levelText} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="salaryDisplay">基础薪资</Label>
                <Input id="salaryDisplay" value={salaryText} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="seniorityPayDisplay">工龄工资</Label>
                <Input
                  id="seniorityPayDisplay"
                  value={`${seniorityPayText}（满 ${employmentYears} 年，每满 1 年 +100，最多 +1000）`}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalSalaryDisplay">计薪薪资</Label>
                <Input id="totalSalaryDisplay" value={totalSalaryText} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualLeaveEntitlementDisplay">年假标准</Label>
                <Input
                  id="annualLeaveEntitlementDisplay"
                  value={`${annualLeaveEntitlement} 天（按 ${annualLeaveYears} 年工龄计算）`}
                  disabled
                />
              </div>
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

      <Card>
        <CardHeader>
          <CardTitle>履历信息</CardTitle>
        </CardHeader>
        <CardContent>
          {profile?.resumeDoc ? (
            (() => {
              const attachment = parseAttachment(profile.resumeDoc)
              return attachment ? (
                <WordPreview attachment={attachment} />
              ) : (
                <div className="text-sm text-gray-500">履历文档格式异常</div>
              )
            })()
          ) : (
            <div className="text-sm text-gray-500">暂无履历文档</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>党员信息</CardTitle>
        </CardHeader>
        <CardContent>
          {profile?.partyInfoDoc ? (
            (() => {
              const attachment = parseAttachment(profile.partyInfoDoc)
              return attachment ? (
                <WordPreview attachment={attachment} />
              ) : (
                <div className="text-sm text-gray-500">党员信息文档格式异常</div>
              )
            })()
          ) : (
            <div className="text-sm text-gray-500">暂无党员信息文档</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
