'use server'

import { prisma } from '@/lib/prisma'
import { leaveSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import { calculateDays } from '@/lib/utils'

export async function createLeaveApplication(formData: FormData) {
  try {
    const validatedData = leaveSchema.parse({
      type: formData.get('type'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      destination: formData.get('destination'),
      reason: formData.get('reason'),
    })

    const userId = formData.get('userId') as string
    if (!userId) {
      return { error: '用户未登录' }
    }

    const action = (formData.get('action') as string) === 'submit' ? 'submit' : 'save'

    // 检查假期余额（仅提交时强校验）
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        year: new Date().getFullYear(),
      },
    })

    const startDateTime = new Date(validatedData.startDate)
    const endDateTime = new Date(validatedData.endDate)
    const rawDays = calculateDays(startDateTime, endDateTime)
    // 请假天数按 0.5 天为粒度向上取整
    const days = Math.ceil(rawDays * 2) / 2

    // 根据假期类型检查余额
    let currentBalance = 0
    if (validatedData.type === 'ANNUAL' && balance) {
      currentBalance = balance.annual
    } else if (validatedData.type === 'SICK' && balance) {
      currentBalance = balance.sick
    } else if (validatedData.type === 'PERSONAL' && balance) {
      currentBalance = balance.personal
    }

    if (
      action === 'submit' &&
      days > currentBalance &&
      validatedData.type !== 'MARRIAGE' &&
      validatedData.type !== 'MATERNITY' &&
      validatedData.type !== 'PATERNITY'
    ) {
      return { error: `假期余额不足，剩余${currentBalance}天` }
    }

    const created = await prisma.leaveApplication.create({
      data: {
        userId,
        type: validatedData.type,
        startDate: startDateTime,
        endDate: endDateTime,
        days,
        reason: validatedData.reason,
        destination: validatedData.destination,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/leave')
    return {
      success: action === 'submit' ? '请假申请已提交' : '请假草稿已保存',
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

export async function getLeaveApplication(id: string) {
  try {
    const app = await prisma.leaveApplication.findUnique({ where: { id } })
    return app
  } catch (error) {
    console.error('获取请假申请详情失败:', error)
    return null
  }
}

export async function deleteLeaveApplication(id: string) {
  try {
    if (!id) return { error: '缺少请假申请 ID' }
    await prisma.approval.deleteMany({
      where: {
        applicationId: id,
        applicationType: 'LEAVE',
      },
    })
    await prisma.leaveApplication.delete({ where: { id } })
    revalidatePath('/dashboard/leave')
    return { success: '请假申请已删除' }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function updateLeaveApplication(formData: FormData) {
  try {
    const id = formData.get('id') as string
    if (!id) {
      return { error: '缺少请假申请 ID' }
    }

    const validatedData = leaveSchema.parse({
      type: formData.get('type'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      destination: formData.get('destination'),
      reason: formData.get('reason'),
    })

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
    })
    if (!application) {
      return { error: '请假申请不存在' }
    }

    if (['COMPLETED', 'APPROVED'].includes(application.status)) {
      return { error: '已完成的申请不可修改' }
    }

    const startDateTime = new Date(validatedData.startDate)
    const endDateTime = new Date(validatedData.endDate)
    const rawDays = calculateDays(startDateTime, endDateTime)
    const days = Math.ceil(rawDays * 2) / 2

    const nextStatus = (formData.get('action') as string) === 'submit' ? 'PENDING' : 'DRAFT'

    await prisma.approval.deleteMany({
      where: {
        applicationId: id,
        applicationType: 'LEAVE',
      },
    })

    await prisma.leaveApplication.update({
      where: { id },
      data: {
        type: validatedData.type,
        startDate: startDateTime,
        endDate: endDateTime,
        days,
        reason: validatedData.reason,
        destination: validatedData.destination,
        status: nextStatus,
        approverId: null,
        approvedAt: null,
        remark: null,
      },
    })

    revalidatePath('/dashboard/leave')
    return { success: nextStatus === 'PENDING' ? '请假申请已提交，审批流程已重新开始' : '请假申请已保存为草稿' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function getLeaveApplications(userId?: string, role?: string) {
  try {
    const where: any = {}
    
    if (role === 'EMPLOYEE' && userId) {
      where.userId = userId
    }

    const applications = await prisma.leaveApplication.findMany({
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

    const leaveTypeMap: Record<string, string> = {
      ANNUAL: '年假',
      SICK: '病假',
      PERSONAL: '事假',
      MARRIAGE: '婚假',
      MATERNITY: '产假',
      PATERNITY: '陪产假',
    }

    return applications.map(app => ({
      ...app,
      userName: app.user.name,
      leaveTypeText: leaveTypeMap[app.type],
    }))
  } catch (error) {
    console.error('获取请假申请列表失败:', error)
    return []
  }
}

export async function getLeaveBalances(userId: string) {
  try {
    if (!userId) {
      return null
    }

    // reseed 后旧 session 里的 userId 可能已经失效，先校验用户是否存在，避免外键报错
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) {
      return null
    }

    // userId 在 schema 中是 unique，直接按 userId 查
    const balance = await prisma.leaveBalance.findUnique({
      where: { userId },
    })

    if (!balance) {
      // 创建默认余额
      const newBalance = await prisma.leaveBalance.create({
        data: {
          userId,
          year: new Date().getFullYear(),
          annual: 5,
          sick: 10,
          personal: 5,
          compensatory: 0,
          usedCompensatory: 0,
        },
      })
      return newBalance
    }

    return balance
  } catch (error) {
    console.error('获取假期余额失败:', error)
    return null
  }
}

export async function getLeaveStats(userId?: string, departmentId?: string) {
  try {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const where: any = {
      status: {
        in: ['APPROVED', 'COMPLETED'],
      },
      startDate: {
        lte: lastDayOfMonth,
      },
      endDate: {
        gte: firstDayOfMonth,
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

    const applications = await prisma.leaveApplication.findMany({
      where,
      select: {
        days: true,
        startDate: true,
        endDate: true,
      },
    })

    let totalDays = 0
    for (const app of applications) {
      // Calculate the overlap between the leave period and current month
      const leaveStart = new Date(app.startDate)
      const leaveEnd = new Date(app.endDate)

      const effectiveStart = leaveStart < firstDayOfMonth ? firstDayOfMonth : leaveStart
      const effectiveEnd = leaveEnd > lastDayOfMonth ? lastDayOfMonth : leaveEnd

      // Calculate days in the overlap period
      const msPerDay = 24 * 60 * 60 * 1000
      const overlapDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / msPerDay) + 1

      // Proportionally allocate the leave days
      const totalLeaveDays = (leaveEnd.getTime() - leaveStart.getTime()) / msPerDay + 1
      const ratio = overlapDays / totalLeaveDays
      totalDays += app.days * ratio
    }

    return Math.round(totalDays * 2) / 2 // Round to nearest 0.5
  } catch (error) {
    console.error('获取请假统计失败:', error)
    return 0
  }
}
