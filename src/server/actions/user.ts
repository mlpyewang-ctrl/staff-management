'use server'

import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

import { authOptions } from '@/lib/auth'
import { ensureLeaveBalance } from '@/lib/leave-balance'
import { recordProfileChangeLogIfChanged } from '@/lib/profile-change-log'
import { prisma } from '@/lib/prisma'
import { userJobAssignmentSchema, userProfileSchema } from '@/lib/validations'

const editableRoles = ['EMPLOYEE', 'MANAGER', 'ATTENDANCE_CLERK'] as const

function parseOptionalDate(value: string | undefined, label: string) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsedDate = new Date(year, (month || 1) - 1, day || 1)

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${label}格式无效`)
  }

  return parsedDate
}

async function getSessionUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error('请先登录后再操作')
  }

  return session.user
}

async function ensureSelfOrAdmin(userId: string) {
  const sessionUser = await getSessionUser()

  if (sessionUser.role !== 'ADMIN' && sessionUser.id !== userId) {
    throw new Error('无权访问该用户信息')
  }

  return sessionUser
}

async function ensureAdmin() {
  const sessionUser = await getSessionUser()

  if (sessionUser.role !== 'ADMIN') {
    throw new Error('只有管理员可以执行此操作')
  }

  return sessionUser
}

export async function getUserProfile(userId: string) {
  try {
    await ensureSelfOrAdmin(userId)

    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        position: true,
      },
    })
  } catch (error) {
    console.error('获取用户资料失败:', error)
    return null
  }
}

export async function getUserProfileChangeHistory(userId: string) {
  try {
    await ensureAdmin()

    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        profileChangeLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
      },
    })
  } catch (error) {
    console.error('获取用户变更记录失败:', error)
    return null
  }
}

export async function updateUserProfile(userId: string, formData: FormData) {
  try {
    const sessionUser = await ensureSelfOrAdmin(userId)

    const getString = (key: string) => {
      const value = formData.get(key)
      return typeof value === 'string' ? value : undefined
    }

    const validated = userProfileSchema.parse({
      name: getString('name'),
      education: getString('education'),
      idCard: getString('idCard'),
      phone: getString('phone'),
      versionRemark: getString('versionRemark'),
    })

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        position: true,
      },
    })

    if (!existingUser) {
      return { error: '未找到对应用户' }
    }

    const nextProfileData = {
      name: validated.name,
      education: validated.education || null,
      idCard: validated.idCard || null,
      phone: validated.phone || null,
    }

    let recordedChange = false

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: nextProfileData,
        include: {
          department: true,
          position: true,
        },
      })

      recordedChange = await recordProfileChangeLogIfChanged({
        tx,
        userId,
        actorId: sessionUser.id,
        actionType: 'PROFILE_UPDATE',
        remark: getString('versionRemark'),
        changes: [
          { label: '姓名', before: existingUser.name, after: nextProfileData.name },
          { label: '学历', before: existingUser.education, after: nextProfileData.education },
          { label: '身份证号', before: existingUser.idCard, after: nextProfileData.idCard },
          { label: '手机号', before: existingUser.phone, after: nextProfileData.phone },
        ],
      })

      return updatedUser
    })

    await ensureLeaveBalance(userId)

    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/profile-history')
    revalidatePath('/dashboard/staff')
    revalidatePath('/dashboard/leave')

    return {
      success: recordedChange ? '个人信息已更新，并已记录变更' : '个人信息已更新',
      user,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }

    return { error: '更新失败，请稍后重试' }
  }
}

export async function getStaffJobAssignments() {
  await ensureAdmin()

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      education: true,
      level: true,
      salary: true,
      educationSalary: true,
      startDate: true,
      seniorityStartDate: true,
      seniorityEndDate: true,
      departmentId: true,
      positionId: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      position: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          baseSalary: true,
          hasSeniorityPay: true,
          seniorityPayPerYear: true,
          maxSeniorityPay: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
}

export async function updateUserJobAssignment(userId: string, formData: FormData) {
  try {
    const sessionUser = await ensureAdmin()

    const getString = (key: string) => {
      const value = formData.get(key)
      return typeof value === 'string' ? value : undefined
    }

    const validated = userJobAssignmentSchema.parse({
      departmentId: getString('departmentId'),
      positionId: getString('positionId'),
      startDate: getString('startDate'),
      seniorityStartDate: getString('seniorityStartDate'),
      seniorityEndDate: getString('seniorityEndDate'),
      versionRemark: getString('versionRemark'),
      educationSalary: getString('educationSalary'),
    })

    const roleValue = getString('role')
    const normalizedRole = roleValue?.toUpperCase()

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        position: true,
      },
    })

    if (!existingUser) {
      return { error: '未找到对应员工' }
    }

    let departmentName: string | null = existingUser.department?.name || null
    let positionName: string | null = existingUser.position?.name || null

    if (validated.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: validated.departmentId },
        select: { id: true, name: true },
      })

      if (!department) {
        return { error: '所选部门不存在' }
      }

      departmentName = department.name
    } else {
      departmentName = null
    }

    let nextPosition: typeof existingUser.position = null
    if (validated.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: validated.positionId },
      })

      if (!position) {
        return { error: '所选岗位不存在' }
      }

      nextPosition = position
      positionName = position.name
    } else {
      positionName = null
    }

    if (
      normalizedRole &&
      !editableRoles.includes(normalizedRole as (typeof editableRoles)[number]) &&
      normalizedRole !== 'ADMIN'
    ) {
      return { error: '角色参数无效' }
    }

    if (
      normalizedRole === 'ATTENDANCE_CLERK' &&
      existingUser.role !== 'ATTENDANCE_CLERK'
    ) {
      // 允许将其他角色设置为考勤员
    }

    if (normalizedRole === 'ADMIN' && existingUser.role !== 'ADMIN') {
      return { error: '不能在此页面将人员设为管理员' }
    }

    const startDate = parseOptionalDate(validated.startDate, '入职日期')
    const seniorityStartDate = parseOptionalDate(validated.seniorityStartDate, '工龄起始日期')
    const seniorityEndDate = parseOptionalDate(validated.seniorityEndDate, '工龄截止日期')

    if (seniorityStartDate && seniorityEndDate && seniorityEndDate < seniorityStartDate) {
      return { error: '工龄截止日期不能早于工龄起始日期' }
    }

    const nextRole = normalizedRole || existingUser.role
    const isPositionChanging = validated.positionId !== undefined && validated.positionId !== existingUser.positionId

    let finalSeniorityStartDate = seniorityStartDate ?? existingUser.seniorityStartDate

    // 调岗工龄逻辑
    if (isPositionChanging && nextPosition) {
      const oldPosition = existingUser.position

      if (oldPosition) {
        const sameSeniorityConfig =
          oldPosition.hasSeniorityPay === true &&
          nextPosition.hasSeniorityPay === true &&
          oldPosition.seniorityPayPerYear === nextPosition.seniorityPayPerYear &&
          oldPosition.maxSeniorityPay === nextPosition.maxSeniorityPay

        const fromNoSeniorityToYes =
          oldPosition.hasSeniorityPay === false &&
          nextPosition.hasSeniorityPay === true

        if (sameSeniorityConfig) {
          // 工龄连续，seniorityStartDate 保持不变
        } else if (fromNoSeniorityToYes) {
          // 从无工龄岗位调到有工龄岗位，从调岗时间开始计算
          finalSeniorityStartDate = new Date()
          finalSeniorityStartDate.setHours(0, 0, 0, 0)
        } else {
          return { error: '当前岗位工龄配置不支持直接调岗，请联系管理员处理' }
        }
      } else {
        // 之前无岗位，新岗位有工龄工资：若没有工龄起始日期，则设为入职日期
        if (nextPosition.hasSeniorityPay === true && !finalSeniorityStartDate) {
          finalSeniorityStartDate = startDate ?? existingUser.startDate
        }
      }
    }

    const educationSalaryValue = validated.educationSalary ? Number(validated.educationSalary) : 0

    const nextJobData: {
      departmentId: string | null
      positionId: string | null
      startDate: Date | null
      seniorityStartDate: Date | null
      seniorityEndDate: Date | null
      role?: string
      salary?: null
      educationSalary?: number
    } = {
      departmentId: validated.departmentId || null,
      positionId: validated.positionId || null,
      startDate,
      seniorityStartDate: finalSeniorityStartDate,
      seniorityEndDate,
      ...(normalizedRole ? { role: normalizedRole } : {}),
      ...(isPositionChanging ? { salary: null } : {}),
      educationSalary: educationSalaryValue,
    }

    let recordedChange = false

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: nextJobData,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          education: true,
          departmentId: true,
          positionId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              name: true,
              departmentId: true,
              baseSalary: true,
              hasSeniorityPay: true,
              seniorityPayPerYear: true,
              maxSeniorityPay: true,
            },
          },
        },
      })

      recordedChange = await recordProfileChangeLogIfChanged({
        tx,
        userId,
        actorId: sessionUser.id,
        actionType: 'JOB_ASSIGNMENT_UPDATE',
        remark: getString('versionRemark'),
        changes: [
          { label: '角色', before: existingUser.role, after: nextRole },
          { label: '部门', before: existingUser.department?.name || null, after: departmentName },
          { label: '岗位', before: existingUser.position?.name || null, after: positionName },
          { label: '入职日期', before: existingUser.startDate, after: startDate },
          { label: '工龄起始日期', before: existingUser.seniorityStartDate, after: finalSeniorityStartDate },
          { label: '工龄截止日期', before: existingUser.seniorityEndDate, after: seniorityEndDate },
          { label: '学历工资', before: existingUser.educationSalary, after: educationSalaryValue },
        ],
      })

      return updatedUser
    })

    await ensureLeaveBalance(userId)

    revalidatePath('/dashboard/staff')
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/profile-history')
    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/salary')

    return {
      success: recordedChange ? '人员信息已更新，并已记录变更' : '人员信息已更新',
      user,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }

    return { error: '更新岗位信息失败，请稍后重试' }
  }
}
