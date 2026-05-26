'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { parseAttachment } from '@/lib/attachment'
import { EDUCATION_OPTIONS } from '@/lib/profile-versioning'
import {
  calculateAnnualLeaveEntitlement,
  calculateCompletedYears,
  calculateSeniorityPay,
  formatDateInputValue,
} from '@/lib/seniority'
import { calculateHourlyRate, formatCurrency } from '@/lib/utils'
import { WordPreview } from '@/components/word-preview'
import { getUserProfile, updateUserProfile } from '@/server/actions/user'
import { changePassword } from '@/server/actions/auth'

interface UserProfile {
  id: string
  username: string
  name: string
  gender?: string | null
  birthDate?: string | Date | null
  ethnicity?: string | null
  householdType?: string | null
  education?: string | null
  idCard?: string | null
  phone?: string | null
  salary?: number | null
  educationSalary?: number | null
  level?: string | null
  startDate?: string | Date | null
  firstWorkDate?: string | Date | null
  resumeDoc?: string | null
  partyInfoDoc?: string | null
  department?: {
    name: string
  } | null
  position?: {
    name: string
    baseSalary?: number | null
    hasSeniorityPay?: boolean | null
    seniorityPayPerYear?: number | null
    maxSeniorityPay?: number | null
  } | null
}

export default function ProfileDashboardPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })

  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

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

  const baseSalaryValue = profile?.position?.baseSalary ?? profile?.salary ?? null
  const salaryText =
    baseSalaryValue !== null
      ? baseSalaryValue.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
      : '未设置'
  const educationSalary = profile?.educationSalary ?? 0
  const educationSalaryText = educationSalary.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
  const seniorityPay = calculateSeniorityPay(
    profile?.startDate,
    undefined,
    profile?.position?.seniorityPayPerYear,
    profile?.position?.maxSeniorityPay,
    profile?.position?.hasSeniorityPay
  )
  const seniorityPayText = seniorityPay.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
  const totalSalaryText =
    baseSalaryValue !== null
      ? (baseSalaryValue + educationSalary + seniorityPay).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
      : '未设置'
  const hourlyRate = baseSalaryValue !== null
    ? Math.round(calculateHourlyRate(baseSalaryValue + educationSalary + seniorityPay) * 100) / 100
    : null


  const employmentYears = calculateCompletedYears(profile?.startDate)
  const annualLeaveYears = calculateCompletedYears(profile?.firstWorkDate)
  const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(profile?.firstWorkDate)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">个人信息</h1>
        <p className="mt-1 text-gray-600">查看和维护您的基础资料</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        部门、岗位、职级、入职日期和工龄信息由管理员统一维护，个人页面只展示结果。
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
                <Label htmlFor="username">账户名</Label>
                <Input id="username" type="text" value={profile?.username || session.user.username || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">性别</Label>
                <Select id="gender" name="gender" defaultValue={profile?.gender || ''} disabled={session?.user?.role !== 'ADMIN'}>
                  <option value="">未填写</option>
                  <option value="MALE">男</option>
                  <option value="FEMALE">女</option>
                </Select>
                {session?.user?.role !== 'ADMIN' && <p className="text-xs text-gray-500">仅管理员可编辑</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">出生日期</Label>
                <Input id="birthDate" name="birthDate" type="date" defaultValue={formatDateInputValue(profile?.birthDate)} disabled={session?.user?.role !== 'ADMIN'} />
                {session?.user?.role !== 'ADMIN' && <p className="text-xs text-gray-500">仅管理员可编辑</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ethnicity">民族</Label>
                <Input id="ethnicity" name="ethnicity" defaultValue={profile?.ethnicity || ''} disabled={session?.user?.role !== 'ADMIN'} />
                {session?.user?.role !== 'ADMIN' && <p className="text-xs text-gray-500">仅管理员可编辑</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="householdType">户口类型</Label>
                <Input id="householdType" name="householdType" defaultValue={profile?.householdType || ''} disabled={session?.user?.role !== 'ADMIN'} />
                {session?.user?.role !== 'ADMIN' && <p className="text-xs text-gray-500">仅管理员可编辑</p>}
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
                <Label htmlFor="education">学历</Label>
                <Select id="education" name="education" defaultValue={profile?.education || ''}>
                  <option value="">未填写</option>
                  {EDUCATION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
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
                <Label htmlFor="firstWorkDate">初次工作时间</Label>
                <Input
                  id="firstWorkDate"
                  name="firstWorkDate"
                  type="date"
                  defaultValue={formatDateInputValue(profile?.firstWorkDate)}
                  disabled
                />
                <p className="text-xs text-gray-500">由管理员在人员岗位页面维护，用于计算年假天数</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentDisplay">部门</Label>
                <Input id="departmentDisplay" value={profile?.department?.name || '未分配'} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positionDisplay">岗位</Label>
                <Input id="positionDisplay" value={profile?.position?.name || '未设置'} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="salaryDisplay">岗位基础工资</Label>
                <Input id="salaryDisplay" value={salaryText} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="educationSalaryDisplay">学历工资</Label>
                <Input id="educationSalaryDisplay" value={educationSalaryText} disabled />
                <p className="text-xs text-gray-500">由管理员在人员岗位页面维护</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="seniorityPayDisplay">工龄工资</Label>
                <Input
                  id="seniorityPayDisplay"
                  value={`${seniorityPayText} (满 ${employmentYears} 年, 每满 1 年 +${profile?.position?.seniorityPayPerYear ?? 100}, 最多 +${profile?.position?.maxSeniorityPay ?? 1000})`}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalSalaryDisplay">计薪薪资</Label>
                <Input id="totalSalaryDisplay" value={totalSalaryText} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRateDisplay">小时工资</Label>
                <Input
                  id="hourlyRateDisplay"
                  value={hourlyRate !== null ? `${formatCurrency(hourlyRate)}/小时` : '未设置'}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualLeaveEntitlementDisplay">年假标准</Label>
                <Input
                  id="annualLeaveEntitlementDisplay"
                  value={`${annualLeaveEntitlement} 天 (按初次工作时间计算，已满 ${annualLeaveYears} 年)`}
                  disabled
                />
              </div>
                            <div className="space-y-2 md:col-span-2">
                <Label htmlFor="versionRemark">变更备注</Label>
                <Input
                  id="versionRemark"
                  name="versionRemark"
                  placeholder="如：手机号更新、身份证补录、学历变更"
                />
                <p className="text-xs text-gray-500">如有字段变更，可填写备注用于操作留痕。</p>
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

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setPwdLoading(true)
              setPwdMessage({ type: '', text: '' })
              const formData = new FormData()
              formData.append('currentPassword', pwdForm.currentPassword)
              formData.append('newPassword', pwdForm.newPassword)
              formData.append('confirmPassword', pwdForm.confirmPassword)
              const result = await changePassword(formData)
              setPwdLoading(false)
              if (result.error) {
                setPwdMessage({ type: 'error', text: result.error })
              } else {
                setPwdMessage({ type: 'success', text: result.success || '密码修改成功' })
                setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">当前密码</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="请输入当前密码"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="至少 6 个字符"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入新密码"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
            </div>
            {pwdMessage.text && (
              <div className={`text-sm ${pwdMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {pwdMessage.text}
              </div>
            )}
            <Button type="submit" disabled={pwdLoading}>
              {pwdLoading ? '修改中...' : '修改密码'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
