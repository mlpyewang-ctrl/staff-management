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

    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '00641c',
      },
      body: JSON.stringify({
        sessionId: '00641c',
        runId: 'pre-fix',
        hypothesisId: 'S1',
        location: 'src/server/actions/overtime.ts:createOvertimeApplication',
        message: 'Create overtime',
        data: {
          action,
          userIdPresent: !!userId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

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
        status: (formData.get('action') as string) === 'submit' ? 'PENDING' : undefined,
      },
    })

    revalidatePath('/dashboard/overtime')
    return { success: (formData.get('action') as string) === 'submit' ? '加班申请已提交' : '加班申请已保存' }
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

export async function getOvertimeStats(userId?: string, departmentId?: string) {
  try {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const where: any = {
      status: 'APPROVED',
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
