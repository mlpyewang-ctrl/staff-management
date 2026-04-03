'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  calculateAnnualLeaveEntitlement,
  calculateCompletedYears,
  calculateSeniorityPay,
  formatDateInputValue,
} from '@/lib/seniority'
import { formatDate } from '@/lib/utils'
import { getDepartments } from '@/server/actions/department'
import { getPositions } from '@/server/actions/position'
import { getStaffJobAssignments, updateUserJobAssignment } from '@/server/actions/user'

interface DepartmentOption {
  id: string
  name: string
}

interface PositionOption {
  id: string
  name: string
  salary: number
  level?: string | null
}

interface StaffUser {
  id: string
  name: string
  email: string
  role: string
  level?: string | null
  startDate?: string | Date | null
  seniorityStartDate?: string | Date | null
  seniorityEndDate?: string | Date | null
  departmentId?: string | null
  positionId?: string | null
  department?: DepartmentOption | null
  position?: PositionOption | null
}

type EditableRole = 'EMPLOYEE' | 'MANAGER'

const emptyFormState = {
  departmentId: '',
  positionId: '',
  level: '',
  startDate: '',
  seniorityStartDate: '',
  seniorityEndDate: '',
  role: 'EMPLOYEE' as EditableRole,
}

const roleOptions: Array<{ value: EditableRole; label: string }> = [
  { value: 'EMPLOYEE', label: '员工' },
  { value: 'MANAGER', label: '部门主管' },
]

function getRoleLabel(role: string) {
  if (role === 'ADMIN') {
    return '管理员'
  }
  if (role === 'MANAGER') {
    return '部门主管'
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
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })

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
        salary: item.salary,
        level: item.level,
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
        setInitialLoading(false)
        return
      }

      try {
        await loadData()
      } catch (error) {
        const text = error instanceof Error ? error.message : '加载人员信息失败'
        setMessage({ type: 'error', text })
      } finally {
        setInitialLoading(false)
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
      level: selectedUser.level || selectedUser.position?.level || '',
      startDate: formatDateInputValue(selectedUser.startDate),
      seniorityStartDate: formatDateInputValue(selectedUser.seniorityStartDate),
      seniorityEndDate: formatDateInputValue(selectedUser.seniorityEndDate),
      role: selectedUser.role === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE',
    })
  }, [selectedUser])

  const filteredStaff = useMemo(() => {
    const search = keyword.trim().toLowerCase()

    if (!search) {
      return staff
    }

    return staff.filter((item) =>
      [item.name, item.email, item.department?.name, item.position?.name, getRoleLabel(item.role)]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search))
    )
  }, [keyword, staff])

  const employmentYears = calculateCompletedYears(formState.startDate || selectedUser?.startDate)
  const seniorityYears = calculateCompletedYears(
    formState.seniorityStartDate || selectedUser?.seniorityStartDate,
    formState.seniorityEndDate || selectedUser?.seniorityEndDate
  )
  const seniorityPayPreview = calculateSeniorityPay(formState.startDate || selectedUser?.startDate)
  const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(
    formState.seniorityStartDate || selectedUser?.seniorityStartDate,
    formState.seniorityEndDate || selectedUser?.seniorityEndDate
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedUserId || !selectedUser) {
      setMessage({ type: 'error', text: '请先选择需要维护的人员' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    const submitData = new FormData()
    submitData.append('departmentId', formState.departmentId)
    submitData.append('positionId', formState.positionId)
    submitData.append('level', formState.level)
    submitData.append('startDate', formState.startDate)
    submitData.append('seniorityStartDate', formState.seniorityStartDate)
    submitData.append('seniorityEndDate', formState.seniorityEndDate)
    if (selectedUser.role !== 'ADMIN') {
      submitData.append('role', formState.role)
    }

    const result = await updateUserJobAssignment(selectedUserId, submitData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      setLoading(false)
      return
    }

    await loadData(selectedUserId)
    setMessage({ type: 'success', text: result.success || '岗位信息已更新' })
    setLoading(false)
  }

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
                  <div>{selectedUser.email}</div>
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
                      const nextPosition = positions.find((item) => item.id === nextPositionId)

                      setFormState((current) => ({
                        ...current,
                        positionId: nextPositionId,
                        level: current.level || !nextPosition?.level ? current.level : nextPosition.level,
                      }))
                    }}
                  >
                    <option value="">未设置</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">岗位职级</Label>
                  <Input
                    id="level"
                    value={formState.level}
                    placeholder="如：P6 / 高级 / 主管级"
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                  />
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
                    <Label htmlFor="seniorityStartDate">工龄起始日期</Label>
                    <Input
                      id="seniorityStartDate"
                      type="date"
                      value={formState.seniorityStartDate}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          seniorityStartDate: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seniorityEndDate">工龄截止日期</Label>
                    <Input
                      id="seniorityEndDate"
                      type="date"
                      value={formState.seniorityEndDate}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          seniorityEndDate: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <div>入职满 {employmentYears} 年</div>
                    <div className="mt-1">工龄满 {seniorityYears} 年</div>
                    <div className="mt-1">年假标准：{annualLeaveEntitlement} 天</div>
                    <div className="mt-1">工龄工资：{seniorityPayPreview.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</div>
                  </div>
                </div>

                {selectedPosition && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    岗位基准薪资：
                    {selectedPosition.salary.toLocaleString('zh-CN', {
                      style: 'currency',
                      currency: 'CNY',
                    })}
                    {selectedPosition.level ? `；默认职级：${selectedPosition.level}` : ''}
                  </div>
                )}

                {message.text && (
                  <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                    {message.text}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? '保存中...' : '保存角色与岗位'}
                </Button>
              </form>
            ) : (
              <div className="text-sm text-gray-500">请选择右侧人员后再配置角色和岗位信息。</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>人员列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={keyword}
              placeholder="搜索姓名、邮箱、部门、岗位或角色"
              onChange={(event) => setKeyword(event.target.value)}
            />

            {initialLoading ? (
              <div className="py-8 text-center text-sm text-gray-500">加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>系统角色</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead>职级</TableHead>
                    <TableHead>入职日期</TableHead>
                    <TableHead>工龄起始</TableHead>
                    <TableHead>工龄截止</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-gray-500">
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
                            <div className="text-xs text-gray-500">{item.email}</div>
                          </TableCell>
                          <TableCell>{getRoleLabel(item.role)}</TableCell>
                          <TableCell>{item.department?.name || '-'}</TableCell>
                          <TableCell>{item.position?.name || '-'}</TableCell>
                          <TableCell>{item.level || item.position?.level || '-'}</TableCell>
                          <TableCell>{item.startDate ? formatDate(new Date(item.startDate)) : '-'}</TableCell>
                          <TableCell>{item.seniorityStartDate ? formatDate(new Date(item.seniorityStartDate)) : '-'}</TableCell>
                          <TableCell>{item.seniorityEndDate ? formatDate(new Date(item.seniorityEndDate)) : '-'}</TableCell>
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
