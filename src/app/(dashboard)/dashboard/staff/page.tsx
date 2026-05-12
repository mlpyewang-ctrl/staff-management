'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useAsyncAction } from '@/lib/use-async-action'
import {
  calculateAnnualLeaveEntitlement,
  calculateCompletedYears,
  calculateSeniorityPay,
  formatDateInputValue,
} from '@/lib/seniority'
import { calculateHourlyRate, formatDate, formatCurrency } from '@/lib/utils'
import { getDepartments } from '@/server/actions/department'
import { getPositions } from '@/server/actions/position'
import { getStaffJobAssignments, updateUserJobAssignment } from '@/server/actions/user'
import { createUser } from '@/server/actions/auth'

interface DepartmentOption {
  id: string
  name: string
}

interface PositionOption {
  id: string
  name: string
  departmentId: string
  baseSalary: number
  hasSeniorityPay: boolean
  seniorityPayPerYear: number
  maxSeniorityPay: number
}

interface StaffUser {
  id: string
  name: string
  username: string
  role: string
  salary?: number | null
  educationSalary?: number | null
  startDate?: string | Date | null
  firstWorkDate?: string | Date | null
  departmentId?: string | null
  positionId?: string | null
  department?: DepartmentOption | null
  position?: PositionOption | null
}

type EditableRole = 'EMPLOYEE' | 'MANAGER' | 'ATTENDANCE_CLERK'

const emptyFormState = {
  departmentId: '',
  positionId: '',
  startDate: '',
  firstWorkDate: '',
  versionRemark: '',
  role: 'EMPLOYEE' as EditableRole,
  educationSalary: '',
}

const roleOptions: Array<{ value: EditableRole; label: string }> = [
  { value: 'EMPLOYEE', label: '员工' },
  { value: 'MANAGER', label: '部门主管' },
  { value: 'ATTENDANCE_CLERK', label: '考勤员' },
]

function getRoleLabel(role: string) {
  if (role === 'ADMIN') {
    return '管理员'
  }
  if (role === 'MANAGER') {
    return '部门主管'
  }
  if (role === 'ATTENDANCE_CLERK') {
    return '考勤员'
  }
  return '员工'
}

export default function StaffDashboardPage() {
  const { data: session } = useSession()
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [positions, setPositions] = useState<PositionOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [formState, setFormState] = useState(emptyFormState)
  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [pageLoading, setPageLoading] = useState(true)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', name: '', role: 'EMPLOYEE' as EditableRole })
  const [createMessage, setCreateMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const loadData = async (preferredUserId?: string) => {
    const [users, departmentOptions, positionOptions] = await Promise.all([
      getStaffJobAssignments(),
      getDepartments(),
      getPositions(),
    ])

    setStaff(users)
    setDepartments(departmentOptions)
    setPositions(
      positionOptions.map((item) => ({
        id: item.id,
        name: item.name,
        departmentId: item.departmentId,
        baseSalary: item.baseSalary,
        hasSeniorityPay: item.hasSeniorityPay,
        seniorityPayPerYear: item.seniorityPayPerYear,
        maxSeniorityPay: item.maxSeniorityPay,
      }))
    )

    const nextSelectedUserId =
      preferredUserId && users.some((item) => item.id === preferredUserId)
        ? preferredUserId
        : users[0]?.id || ''

    setSelectedUserId(nextSelectedUserId)
  }

  useEffect(() => {
    const load = async () => {
      if (session?.user?.role !== 'ADMIN') {
        setPageLoading(false)
        return
      }

      try {
        await loadData()
      } catch (error) {
        const text = error instanceof Error ? error.message : '加载人员信息失败'
        setMessage({ type: 'error', text })
      } finally {
        setPageLoading(false)
      }
    }

    load()
  }, [session?.user?.role])

  const selectedUser = staff.find((item) => item.id === selectedUserId) || null
  const selectedPosition = positions.find((item) => item.id === formState.positionId) || null

  useEffect(() => {
    if (!selectedUser) {
      setFormState(emptyFormState)
      return
    }

    setFormState({
      departmentId: selectedUser.departmentId || '',
      positionId: selectedUser.positionId || '',
      startDate: formatDateInputValue(selectedUser.startDate),
      firstWorkDate: formatDateInputValue(selectedUser.firstWorkDate),
      versionRemark: '',
      role: ['MANAGER', 'ATTENDANCE_CLERK'].includes(selectedUser.role) ? (selectedUser.role as EditableRole) : 'EMPLOYEE',
      educationSalary: selectedUser.educationSalary ? String(selectedUser.educationSalary) : '',
    })
  }, [selectedUser])

  const filteredStaff = useMemo(() => {
    const search = keyword.trim().toLowerCase()

    if (!search) {
      return staff
    }

    return staff.filter((item) =>
      [item.name, item.username, item.department?.name, item.position?.name, getRoleLabel(item.role)]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search))
    )
  }, [keyword, staff])

  const employmentYears = calculateCompletedYears(formState.startDate || selectedUser?.startDate)
  const baseSalaryPreview = (selectedPosition?.baseSalary ?? selectedUser?.salary ?? 0) + (Number(formState.educationSalary) || selectedUser?.educationSalary || 0)
  const seniorityPayPreview = calculateSeniorityPay(
    formState.startDate || selectedUser?.startDate,
    undefined,
    selectedPosition?.seniorityPayPerYear,
    selectedPosition?.maxSeniorityPay
  )
  const hourlyRatePreview = Math.round(calculateHourlyRate(baseSalaryPreview + seniorityPayPreview) * 100) / 100
  const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(
    formState.firstWorkDate || selectedUser?.firstWorkDate
  )

  const { loading: submitLoading, execute: executeSubmit } = useAsyncAction(async () => {
    if (!selectedUserId || !selectedUser) {
      setMessage({ type: 'error', text: '请先选择需要维护的人员' })
      return
    }

    setMessage({ type: '', text: '' })

    const submitData = new FormData()
    submitData.append('departmentId', formState.departmentId)
    submitData.append('positionId', formState.positionId)
    submitData.append('startDate', formState.startDate)
    submitData.append('firstWorkDate', formState.firstWorkDate)
    submitData.append('versionRemark', formState.versionRemark)
    submitData.append('educationSalary', formState.educationSalary)
    if (selectedUser.role !== 'ADMIN') {
      submitData.append('role', formState.role)
    }

    const result = await updateUserJobAssignment(selectedUserId, submitData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }

    await loadData(selectedUserId)
    setMessage({ type: 'success', text: result.success || '岗位信息已更新' })
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    executeSubmit()
  }

  const { loading: createLoading, execute: executeCreate } = useAsyncAction(async () => {
    const formData = new FormData()
    formData.append('username', createForm.username)
    formData.append('name', createForm.name)
    formData.append('role', createForm.role)
    const result = await createUser(formData)
    if (result.error) {
      setCreateMessage({ type: 'error', text: result.error })
    } else {
      setCreateMessage({ type: 'success', text: result.success || '账号创建成功' })
      setCreateForm({ username: '', name: '', role: 'EMPLOYEE' })
      await loadData()
      setTimeout(() => setShowCreateForm(false), 1500)
    }
  })

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">人员管理</h1>
        <p className="text-gray-600">仅管理员可以访问该模块。</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">人员管理</h1>
        <p className="mt-1 text-gray-600">统一维护系统角色、岗位和任职日期，可在此指定谁是部门主管（MANAGER）。</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>角色与岗位配置</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedUser ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <div className="font-medium text-gray-900">{selectedUser.name}</div>
                  <div>{selectedUser.username}</div>
                  <div className="mt-1">当前系统角色：{getRoleLabel(selectedUser.role)}</div>
                  <div className="mt-1 text-gray-500">{selectedUser.department?.name || '未分配部门'} · {selectedUser.position?.name || '未设置岗位'}</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">系统角色</Label>
                  {selectedUser.role === 'ADMIN' ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      管理员账户的角色不能在此页面修改
                    </div>
                  ) : (
                    <Select
                      id="role"
                      value={formState.role}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          role: event.target.value as EditableRole,
                        }))
                      }
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departmentId">部门</Label>
                  <select
                    id="departmentId"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={formState.departmentId}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        departmentId: event.target.value,
                      }))
                    }
                  >
                    <option value="">未分配</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="positionId">岗位</Label>
                  <select
                    id="positionId"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={formState.positionId}
                    onChange={(event) => {
                      const nextPositionId = event.target.value

                      setFormState((current) => ({
                        ...current,
                        positionId: nextPositionId,
                      }))
                    }}
                  >
                    <option value="">未设置</option>
                    {positions
                      .filter((position) => !formState.departmentId || position.departmentId === formState.departmentId)
                      .map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">入职日期</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formState.startDate}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firstWorkDate">初次工作时间</Label>
                    <Input
                      id="firstWorkDate"
                      type="date"
                      value={formState.firstWorkDate}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          firstWorkDate: event.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-gray-500">用于计算年假天数</p>
                  </div>

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <div>入职满 {employmentYears} 年</div>
                    <div className="mt-1">年假标准：{annualLeaveEntitlement} 天</div>
                    <div className="mt-1">工龄工资：{seniorityPayPreview.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</div>
                    <div className="mt-1 border-t border-emerald-200 pt-2">
                      <div>时薪：{formatCurrency(hourlyRatePreview)}/小时</div>
                      <div className="mt-1 text-xs text-emerald-700">
                        工作日加班 {formatCurrency(hourlyRatePreview * 1.5)}/小时 ·
                        周末 {formatCurrency(hourlyRatePreview * 2)}/小时 ·
                        节假日 {formatCurrency(hourlyRatePreview * 3)}/小时
                      </div>
                    </div>
                    {selectedPosition && !selectedPosition.hasSeniorityPay && (
                      <div className="mt-1 text-amber-600">当前岗位无工龄工资</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="educationSalary">学历工资</Label>
                  <Input
                    id="educationSalary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.educationSalary}
                    placeholder="0"
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        educationSalary: event.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">按月发放的固定学历补贴，计入基本工资</p>
                </div>

                {selectedPosition && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <div>岗位基础工资：{selectedPosition.baseSalary.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</div>
                    <div className="mt-1">工龄工资：每年 {selectedPosition.seniorityPayPerYear.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}，上限 {selectedPosition.maxSeniorityPay.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="versionRemark">变更备注</Label>
                  <Input
                    id="versionRemark"
                    value={formState.versionRemark}
                    placeholder="如：因升职调整为主管、岗位变更为招商主管"
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        versionRemark: event.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">当本次保存涉及角色、岗位或日期变更时，可填写备注用于操作留痕。</p>
                </div>

                {message.text && (
                  <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                    {message.text}
                  </div>
                )}

                <Button type="submit" loading={submitLoading} className="w-full">
                  保存角色与岗位
                </Button>
              </form>
            ) : (
              <div className="text-sm text-gray-500">请选择右侧人员后再配置角色和岗位信息。</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>人员列表</CardTitle>
            <Button size="sm" onClick={() => { setShowCreateForm(true); setCreateMessage(null) }}>
              新建账号
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showCreateForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setCreateMessage(null)
                  executeCreate()
                }}
                className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <h3 className="text-sm font-semibold text-gray-900">新建账号</h3>
                <div className="space-y-2">
                  <Label htmlFor="create-username">账户名</Label>
                  <Input
                    id="create-username"
                    placeholder="请输入账户名"
                    value={createForm.username}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">姓名</Label>
                  <Input
                    id="create-name"
                    placeholder="请输入姓名"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">系统角色</Label>
                  <Select
                    id="create-role"
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as EditableRole }))}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>默认密码</Label>
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    系统已分配默认密码
                  </div>
                  <p className="text-xs text-gray-500">创建后请通知用户尽快在个人页面修改密码</p>
                </div>
                {createMessage && (
                  <div className={`text-sm ${createMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                    {createMessage.text}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" loading={createLoading} className="flex-1">
                    创建账号
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    取消
                  </Button>
                </div>
              </form>
            )}

            <Input
              value={keyword}
              placeholder="搜索姓名、账户名、部门、岗位或角色"
              onChange={(event) => setKeyword(event.target.value)}
            />

            {pageLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-gray-500">
                <LoadingSpinner size="md" />
                <span>加载中...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>系统角色</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead>学历工资</TableHead>
                    <TableHead>入职日期</TableHead>
                    <TableHead>初次工作时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-gray-500">
                        暂无匹配人员
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((item) => {
                      const isActive = item.id === selectedUserId

                      return (
                        <TableRow key={item.id} className={isActive ? 'bg-blue-50/60' : ''}>
                          <TableCell>
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.username}</div>
                          </TableCell>
                          <TableCell>{getRoleLabel(item.role)}</TableCell>
                          <TableCell>{item.department?.name || '-'}</TableCell>
                          <TableCell>{item.position?.name || '-'}</TableCell>
                          <TableCell>{item.educationSalary ? item.educationSalary.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }) : '-'}</TableCell>
                          <TableCell>{item.startDate ? formatDate(new Date(item.startDate)) : '-'}</TableCell>
                          <TableCell>{item.firstWorkDate ? formatDate(new Date(item.firstWorkDate)) : '-'}</TableCell>
                          <TableCell>
                            <Button variant={isActive ? 'default' : 'outline'} size="sm" onClick={() => setSelectedUserId(item.id)}>
                              {isActive ? '编辑中' : '编辑'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
