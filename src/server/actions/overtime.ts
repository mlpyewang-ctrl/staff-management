'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { requireSessionUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { calculateHours } from '@/lib/utils'
import { overtimeSchema } from '@/lib/validations'

async function requireOvertimeOwnerOrAdmin(id: string) {
  const sessionUser = await requireSessionUser()
  const application = await prisma.overtimeApplication.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  })

  if (!application) {
    return {
      sessionUser,
      application: null,
    }
  }

  if (sessionUser.role !== 'ADMIN' && sessionUser.id !== application.userId) {
    throw new Error('无权操作该加班申请')
  }

  return {
    sessionUser,
    application,
  }
}

export async function createOvertimeApplication(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const validatedData = overtimeSchema.parse({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      type: formData.get('type'),
      reason: formData.get('reason'),
    })

    const startDateTime = new Date(`${validatedData.date} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.date} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    const action = formData.get('action') === 'submit' ? 'submit' : 'save'
    const created = await prisma.overtimeApplication.create({
      data: {
        userId: sessionUser.id,
        date: startDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
        hours,
        type: validatedData.type,
        reason: validatedData.reason,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/overtime')

    return {
      success: action === 'submit' ? '加班申请已提交' : '加班草稿已保存',
      id: created.id,
      status: created.status,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交失败，请稍后重试' }
  }
}

export async function deleteOvertimeApplication(id: string) {
  try {
    if (!id) {
      return { error: '缺少加班申请 ID' }
    }

    const { application } = await requireOvertimeOwnerOrAdmin(id)

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的加班申请可以删除' }
    }

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'OVERTIME',
        },
      }),
      prisma.overtimeApplication.delete({
        where: { id },
      }),
    ])

    revalidatePath('/dashboard/overtime')
    return { success: '加班申请已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function updateOvertimeApplication(formData: FormData) {
  try {
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
      return { error: '缺少加班申请 ID' }
    }

    const validatedData = overtimeSchema.parse({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      type: formData.get('type'),
      reason: formData.get('reason'),
    })

    const { application } = await requireOvertimeOwnerOrAdmin(id)

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的加班申请可以修改' }
    }

    const startDateTime = new Date(`${validatedData.date} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.date} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    const nextStatus = formData.get('action') === 'submit' ? 'PENDING' : 'DRAFT'

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'OVERTIME',
        },
      }),
      prisma.overtimeApplication.update({
        where: { id },
        data: {
          date: startDateTime,
          startTime: startDateTime,
          endTime: endDateTime,
          hours,
          type: validatedData.type,
          reason: validatedData.reason,
          status: nextStatus,
          approverId: null,
          approvedAt: null,
          remark: null,
        },
      }),
    ])

    revalidatePath('/dashboard/overtime')
    return {
      success:
        nextStatus === 'PENDING' ? '加班申请已提交，审批流程已重新开始' : '加班申请已保存为草稿',
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function getOvertimeApplications(_userId?: string, _role?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const where: Prisma.OvertimeApplicationWhereInput =
      sessionUser.role === 'EMPLOYEE'
        ? {
            userId: sessionUser.id,
          }
        : {}

    const applications = await prisma.overtimeApplication.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return applications.map((application) => ({
      ...application,
      userName: application.user.name,
    }))
  } catch (error) {
    console.error('获取加班申请列表失败:', error)
    return []
  }
}

export async function getOvertimeApplication(id: string) {
  try {
    const sessionUser = await requireSessionUser()
    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!application) {
      return null
    }

    if (sessionUser.role === 'EMPLOYEE' && application.userId !== sessionUser.id) {
      return null
    }

    return {
      ...application,
      userName: application.user.name,
    }
  } catch (error) {
    console.error('获取加班申请详情失败:', error)
    return null
  }
}

export async function getOvertimeStats(userId?: string, departmentId?: string, referenceMonth?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const now = new Date()
    const [year, month] = referenceMonth
      ? referenceMonth.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1]
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59)

    const where: Prisma.OvertimeApplicationWhereInput = {
      status: {
        in: ['COMPLETED'],
      },
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    }

    if (sessionUser.role === 'EMPLOYEE') {
      where.userId = sessionUser.id
    } else if (userId) {
      where.userId = userId
    }

    if (departmentId && sessionUser.role !== 'EMPLOYEE') {
      where.user = {
        departmentId,
      }
    }

    const result = await prisma.overtimeApplication.aggregate({
      where,
      _sum: {
        actualHours: true,
      },
    })

    return result._sum.actualHours || 0
  } catch (error) {
    console.error('获取加班统计失败:', error)
    return 0
  }
}

// 提交加班确认（申请人填写实际加班时间后提交）
export async function submitOvertimeConfirmation(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const id = formData.get('id') as string

    if (!id) {
      return { error: '缺少加班申请 ID' }
    }

    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    })

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.userId !== sessionUser.id) {
      return { error: '无权操作该加班申请' }
    }

    if (application.status !== 'PRE_APPROVED') {
      return { error: '只有事前审批通过的加班申请可以提交确认' }
    }

    const date = formData.get('date') as string
    const startTime = formData.get('startTime') as string
    const endTime = formData.get('endTime') as string

    if (!date || !startTime || !endTime) {
      return { error: '请填写完整的实际加班时间' }
    }

    const actualStartTime = new Date(`${date} ${startTime}`)
    const actualEndTime = new Date(`${date} ${endTime}`)
    const actualHours = calculateHours(actualStartTime, actualEndTime)

    if (actualHours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    await prisma.overtimeApplication.update({
      where: { id },
      data: {
        actualStartTime,
        actualEndTime,
        actualHours,
        status: 'CONFIRM_PENDING',
        currentPhase: 'CONFIRM',
      },
    })

    revalidatePath('/dashboard/overtime')
    return { success: '加班确认已提交，进入确认审批流程' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交确认失败，请稍后重试' }
  }
}
