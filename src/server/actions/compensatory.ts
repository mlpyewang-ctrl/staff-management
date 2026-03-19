'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { compensatoryUseSchema } from '@/lib/validations'
import { SALARY_CONSTANTS } from '@/types'

// 获取用户调休信息
export async function getCompensatoryInfo(userId: string) {
  try {
    // 获取假期余额
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: { userId },
    })

    // 获取已清算的加班时长（已计薪或已转调休）
    const settledOvertime = await prisma.overtimeSettlement.findMany({
      where: { userId },
      select: { hours: true },
    })

    const settledOvertimeHours = settledOvertime.reduce((sum, s) => sum + s.hours, 0)

    return {
      totalCompensatory: leaveBalance?.compensatory || 0,
      availableCompensatory: (leaveBalance?.compensatory || 0) - (leaveBalance?.usedCompensatory || 0),
      usedCompensatory: leaveBalance?.usedCompensatory || 0,
      settledOvertimeHours,
    }
  } catch (error) {
    console.error('获取调休信息失败:', error)
    return {
      totalCompensatory: 0,
      availableCompensatory: 0,
      usedCompensatory: 0,
      settledOvertimeHours: 0,
    }
  }
}

// 使用调休
export async function useCompensatory(formData: FormData) {
  try {
    const userId = formData.get('userId') as string
    if (!userId) {
      return { error: '用户未登录' }
    }

    const validatedData = compensatoryUseSchema.parse({
      hours: formData.get('hours'),
      startDate: formData.get('startDate'),
      reason: formData.get('reason'),
    })

    const hoursToUse = Number(validatedData.hours)

    // 获取当前调休余额
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: { userId },
    })

    if (!leaveBalance) {
      return { error: '未找到假期余额记录' }
    }

    const availableCompensatory = leaveBalance.compensatory - leaveBalance.usedCompensatory

    if (availableCompensatory < hoursToUse) {
      return { error: `调休余额不足，当前可用 ${availableCompensatory} 小时` }
    }

    // 创建调休请假记录
    const startDate = new Date(validatedData.startDate)
    const isFullDay = hoursToUse === SALARY_CONSTANTS.FULL_DAY_HOURS

    const leaveApp = await prisma.leaveApplication.create({
      data: {
        userId,
        type: 'PERSONAL', // 调休作为事假处理
        startDate,
        endDate: startDate,
        days: isFullDay ? 1 : 0.5,
        reason: `[调休] ${validatedData.reason}`,
        status: 'PENDING',
      },
    })

    // 更新已使用调休
    await prisma.leaveBalance.update({
      where: { userId },
      data: {
        usedCompensatory: {
          increment: hoursToUse,
        },
      },
    })

    revalidatePath('/dashboard/compensatory')
    revalidatePath('/dashboard/leave')
    return {
      success: '调休申请已提交，等待审批',
      leaveApplicationId: leaveApp.id,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '申请失败，请稍后重试' }
  }
}

// 获取调休使用记录
export async function getCompensatoryUsageHistory(userId: string) {
  try {
    // 获取所有调休相关的请假记录
    const leaveApps = await prisma.leaveApplication.findMany({
      where: {
        userId,
        reason: {
          contains: '[调休]',
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return leaveApps.map((app) => ({
      id: app.id,
      date: app.startDate,
      days: app.days,
      hours: app.days * SALARY_CONSTANTS.HOURS_PER_DAY,
      reason: app.reason.replace('[调休] ', ''),
      status: app.status,
      createdAt: app.createdAt,
    }))
  } catch (error) {
    console.error('获取调休使用记录失败:', error)
    return []
  }
}

// 获取调休来源记录（加班转调休的记录）
export async function getCompensatorySourceHistory(userId: string) {
  try {
    const settlements = await prisma.overtimeSettlement.findMany({
      where: {
        userId,
        settlementType: 'COMPENSATORY',
      },
      include: {
        overtime: true,
        salaryRecord: {
          select: { month: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return settlements.map((s) => ({
      id: s.id,
      date: s.overtime.date,
      hours: s.hours,
      overtimeType: s.overtime.type,
      salaryMonth: s.salaryRecord?.month,
      createdAt: s.createdAt,
    }))
  } catch (error) {
    console.error('获取调休来源记录失败:', error)
    return []
  }
}

// 管理员手动添加调休
export async function adminAddCompensatory(formData: FormData) {
  try {
    const userId = formData.get('userId') as string
    const hours = Number(formData.get('hours'))
    const reason = formData.get('reason') as string

    if (!userId || !hours || hours <= 0) {
      return { error: '参数无效' }
    }

    // 获取或创建假期余额记录
    let leaveBalance = await prisma.leaveBalance.findUnique({
      where: { userId },
    })

    if (!leaveBalance) {
      const currentYear = new Date().getFullYear()
      leaveBalance = await prisma.leaveBalance.create({
        data: {
          userId,
          year: currentYear,
          annual: 5,
          sick: 10,
          personal: 5,
          compensatory: 0,
          usedCompensatory: 0,
        },
      })
    }

    // 更新调休余额
    await prisma.leaveBalance.update({
      where: { userId },
      data: {
        compensatory: {
          increment: hours,
        },
      },
    })

    // 记录日志（可以后续添加日志表）
    console.log(`管理员添加调休: 用户 ${userId}, 小时数 ${hours}, 原因: ${reason}`)

    revalidatePath('/dashboard/compensatory')
    return { success: `成功添加 ${hours} 小时调休` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '添加失败，请稍后重试' }
  }
}

// 获取所有员工的调休信息（管理员用）
export async function getAllCompensatoryInfo(departmentId?: string) {
  try {
    const userWhere = departmentId ? { departmentId } : {}

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        leaveBalance: true,
        department: {
          select: { name: true },
        },
        position: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return users.map((user) => ({
      userId: user.id,
      userName: user.name,
      departmentName: user.department?.name,
      positionName: user.position?.name,
      totalCompensatory: user.leaveBalance?.compensatory || 0,
      usedCompensatory: user.leaveBalance?.usedCompensatory || 0,
      availableCompensatory:
        (user.leaveBalance?.compensatory || 0) - (user.leaveBalance?.usedCompensatory || 0),
    }))
  } catch (error) {
    console.error('获取员工调休信息失败:', error)
    return []
  }
}
