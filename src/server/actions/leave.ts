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
      reason: formData.get('reason'),
    })

    const userId = formData.get('userId') as string
    if (!userId) {
      return { error: '用户未登录' }
    }

    // 检查假期余额
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        year: new Date().getFullYear(),
      },
    })

    const startDateTime = new Date(validatedData.startDate)
    const endDateTime = new Date(validatedData.endDate)
    const days = calculateDays(startDateTime, endDateTime)

    // 根据假期类型检查余额
    let currentBalance = 0
    if (validatedData.type === 'ANNUAL' && balance) {
      currentBalance = balance.annual
    } else if (validatedData.type === 'SICK' && balance) {
      currentBalance = balance.sick
    } else if (validatedData.type === 'PERSONAL' && balance) {
      currentBalance = balance.personal
    }

    if (days > currentBalance && validatedData.type !== 'MARRIAGE' && validatedData.type !== 'MATERNITY' && validatedData.type !== 'PATERNITY') {
      return { error: `假期余额不足，剩余${currentBalance}天` }
    }

    await prisma.leaveApplication.create({
      data: {
        userId,
        type: validatedData.type,
        startDate: startDateTime,
        endDate: endDateTime,
        days,
        reason: validatedData.reason,
        status: 'PENDING',
      },
    })

    revalidatePath('/dashboard/leave')
    return { success: '请假申请已提交' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交失败，请稍后重试' }
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
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        year: new Date().getFullYear(),
      },
    })

    if (!balance) {
      // 创建默认余额
      const newBalance = await prisma.leaveBalance.create({
        data: {
          userId,
          year: new Date().getFullYear(),
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
