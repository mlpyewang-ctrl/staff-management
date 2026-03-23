'use server'

import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userJobAssignmentSchema, userProfileSchema } from '@/lib/validations'

const editableRoles = ['EMPLOYEE', 'MANAGER'] as const

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

export async function updateUserProfile(userId: string, formData: FormData) {
  try {
    await ensureSelfOrAdmin(userId)

    const getString = (key: string) => {
      const value = formData.get(key)
      return typeof value === 'string' ? value : undefined
    }

    const validated = userProfileSchema.parse({
      name: getString('name'),
      idCard: getString('idCard'),
      phone: getString('phone'),
      startDate: getString('startDate'),
    })

    const startDate = validated.startDate ? new Date(validated.startDate) : null

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: validated.name,
        idCard: validated.idCard || null,
        phone: validated.phone || null,
        startDate,
      },
      include: {
        department: true,
        position: true,
      },
    })

    revalidatePath('/dashboard/profile')

    return { success: '个人信息已更新', user }
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
      email: true,
      role: true,
      level: true,
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
          level: true,
          salary: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
}

export async function updateUserJobAssignment(userId: string, formData: FormData) {
  try {
    await ensureAdmin()

    const getString = (key: string) => {
      const value = formData.get(key)
      return typeof value === 'string' ? value : undefined
    }

    const validated = userJobAssignmentSchema.parse({
      departmentId: getString('departmentId'),
      positionId: getString('positionId'),
      level: getString('level'),
    })

    const roleValue = getString('role')
    const normalizedRole = roleValue?.toUpperCase()

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        positionId: true,
      },
    })

    if (!existingUser) {
      return { error: '未找到对应人员' }
    }

    if (validated.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: validated.departmentId },
        select: { id: true },
      })

      if (!department) {
        return { error: '所选部门不存在' }
      }
    }

    if (validated.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: validated.positionId },
        select: { id: true },
      })

      if (!position) {
        return { error: '所选岗位不存在' }
      }
    }

    if (normalizedRole && !editableRoles.includes(normalizedRole as (typeof editableRoles)[number]) && normalizedRole !== 'ADMIN') {
      return { error: '角色参数无效' }
    }

    if (normalizedRole === 'ADMIN' && existingUser.role !== 'ADMIN') {
      return { error: '不能在此页面将人员设置为管理员' }
    }

    const shouldResetSalary = Boolean(
      validated.positionId && validated.positionId !== existingUser.positionId
    )

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        departmentId: validated.departmentId || null,
        positionId: validated.positionId || null,
        level: validated.level || null,
        ...(normalizedRole ? { role: normalizedRole } : {}),
        ...(shouldResetSalary ? { salary: null } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        level: true,
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
            level: true,
            salary: true,
          },
        },
      },
    })

    revalidatePath('/dashboard/staff')
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/salary')

    return { success: '人员信息已更新', user }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新岗位信息失败，请稍后重试' }
  }
}
