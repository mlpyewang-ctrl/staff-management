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

    await prisma.overtimeApplication.create({
      data: {
        userId,
        date: startDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
        hours,
        type: validatedData.type,
        reason: validatedData.reason,
        status: 'PENDING',
      },
    })

    revalidatePath('/dashboard/overtime')
    return { success: '加班申请已提交' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交失败，请稍后重试' }
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

    // 计算加班时长
    const startDateTime = new Date(`${validatedData.date} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.date} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    await prisma.overtimeApplication.update({
      where: { id },
      data: {
        date: startDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
        hours,
        type: validatedData.type,
        reason: validatedData.reason,
      },
    })

    revalidatePath('/dashboard/overtime')
    return { success: '加班申请已更新' }
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
