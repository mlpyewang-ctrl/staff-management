'use server'

import { prisma } from '@/lib/prisma'
import { overtimeSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import { calculateHours } from '@/lib/utils'

export async function createOvertimeApplication(formData: FormData) {
  try {
    const validatedData = overtimeSchema.parse({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      type: formData.get('type'),
      reason: formData.get('reason'),
    })

    const userId = formData.get('userId') as string
    if (!userId) {
      return { error: '用户未登录' }
    }

    // 计算加班时长
    const startDateTime = new Date(`${validatedData.date} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.date} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    const action = (formData.get('action') as string) === 'submit' ? 'submit' : 'save'

    const created = await prisma.overtimeApplication.create({
      data: {
        userId,
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
    if (!id) return { error: '缺少加班申请 ID' }
    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      select: {
        status: true,
      },
    })

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的加班申请可以删除' }
    }

    await prisma.approval.deleteMany({
      where: {
        applicationId: id,
        applicationType: 'OVERTIME',
      },
    })
    await prisma.overtimeApplication.delete({ where: { id } })
    revalidatePath('/dashboard/overtime')
    return { success: '加班申请已删除' }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function updateOvertimeApplication(formData: FormData) {
  try {
    const id = formData.get('id') as string
    if (!id) {
      return { error: '缺少加班申请 ID' }
    }

    const validatedData = overtimeSchema.parse({
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      type: formData.get('type'),
      reason: formData.get('reason'),
    })

    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      select: {
        status: true,
      },
    })

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的加班申请可以修改' }
    }

    // 计算加班时长
    const startDateTime = new Date(`${validatedData.date} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.date} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    const nextStatus = (formData.get('action') as string) === 'submit' ? 'PENDING' : 'DRAFT'

    await prisma.approval.deleteMany({
      where: {
        applicationId: id,
        applicationType: 'OVERTIME',
      },
    })

    await prisma.overtimeApplication.update({
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
    })

    revalidatePath('/dashboard/overtime')
    return { success: nextStatus === 'PENDING' ? '加班申请已提交，审批流程已重新开始' : '加班申请已保存为草稿' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function getOvertimeApplications(userId?: string, role?: string) {
  try {
    const where: any = {}
    
    if (role === 'EMPLOYEE' && userId) {
      where.userId = userId
    }

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

    return applications.map(app => ({
      ...app,
      userName: app.user.name,
    }))
  } catch (error) {
    console.error('获取加班申请列表失败:', error)
    return []
  }
}

export async function getOvertimeApplication(id: string) {
  try {
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
    const now = new Date()
    const [year, month] = referenceMonth
      ? referenceMonth.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1]
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59)

    const where: any = {
      status: {
        in: ['APPROVED', 'COMPLETED'],
      },
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    }

    if (userId) {
      where.userId = userId
    }

    if (departmentId) {
      where.user = {
        departmentId: departmentId,
      }
    }

    const result = await prisma.overtimeApplication.aggregate({
      where,
      _sum: {
        hours: true,
      },
    })

    return result._sum.hours || 0
  } catch (error) {
    console.error('获取加班统计失败:', error)
    return 0
  }
}
