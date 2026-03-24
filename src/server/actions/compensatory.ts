'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminUser, requireSelfOrAdmin, requireSessionUser } from '@/lib/action-auth'
import { ensureLeaveBalance } from '@/lib/leave-balance'
import { prisma } from '@/lib/prisma'
import { compensatoryUseSchema } from '@/lib/validations'
import { SALARY_CONSTANTS } from '@/types'

export async function getCompensatoryInfo(userId: string) {
  try {
    await requireSelfOrAdmin(userId)

    const leaveBalance = await ensureLeaveBalance(userId)
    const settledOvertime = await prisma.overtimeSettlement.findMany({
      where: { userId },
      select: { hours: true },
    })
    const settledOvertimeHours = settledOvertime.reduce((sum, settlement) => sum + settlement.hours, 0)

    return {
      totalCompensatory: leaveBalance.compensatory || 0,
      availableCompensatory: (leaveBalance.compensatory || 0) - (leaveBalance.usedCompensatory || 0),
      usedCompensatory: leaveBalance.usedCompensatory || 0,
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

export async function useCompensatory(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const validatedData = compensatoryUseSchema.parse({
      hours: formData.get('hours'),
      startDate: formData.get('startDate'),
      reason: formData.get('reason'),
    })

    const hoursToUse = Number(validatedData.hours)
    const leaveBalance = await ensureLeaveBalance(sessionUser.id)
    const availableCompensatory = leaveBalance.compensatory - leaveBalance.usedCompensatory

    if (availableCompensatory < hoursToUse) {
      return { error: `调休余额不足，当前可用 ${availableCompensatory} 小时` }
    }

    const startDate = new Date(validatedData.startDate)
    const isFullDay = hoursToUse === SALARY_CONSTANTS.FULL_DAY_HOURS

    const [leaveApplication] = await prisma.$transaction([
      prisma.leaveApplication.create({
        data: {
          userId: sessionUser.id,
          type: 'PERSONAL',
          startDate,
          endDate: startDate,
          days: isFullDay ? 1 : 0.5,
          reason: `[调休] ${validatedData.reason}`,
          status: 'PENDING',
        },
      }),
      prisma.leaveBalance.update({
        where: { userId: sessionUser.id },
        data: {
          usedCompensatory: {
            increment: hoursToUse,
          },
        },
      }),
    ])

    revalidatePath('/dashboard/compensatory')
    revalidatePath('/dashboard/leave')
    return {
      success: '调休申请已提交，等待审批',
      leaveApplicationId: leaveApplication.id,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '申请失败，请稍后重试' }
  }
}

export async function getCompensatoryUsageHistory(userId: string) {
  try {
    await requireSelfOrAdmin(userId)

    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        userId,
        reason: {
          contains: '[调休]',
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return leaveApplications.map((application) => ({
      id: application.id,
      date: application.startDate,
      days: application.days,
      hours: application.days * SALARY_CONSTANTS.HOURS_PER_DAY,
      reason: application.reason.replace('[调休] ', ''),
      status: application.status,
      createdAt: application.createdAt,
    }))
  } catch (error) {
    console.error('获取调休使用记录失败:', error)
    return []
  }
}

export async function getCompensatorySourceHistory(userId: string) {
  try {
    await requireSelfOrAdmin(userId)

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

    return settlements.map((settlement) => ({
      id: settlement.id,
      date: settlement.overtime.date,
      hours: settlement.hours,
      overtimeType: settlement.overtime.type,
      salaryMonth: settlement.salaryRecord?.month,
      createdAt: settlement.createdAt,
    }))
  } catch (error) {
    console.error('获取调休来源记录失败:', error)
    return []
  }
}

export async function adminAddCompensatory(formData: FormData) {
  try {
    await requireAdminUser()

    const userId = formData.get('userId')
    const hours = Number(formData.get('hours'))
    const reason = formData.get('reason')

    if (typeof userId !== 'string' || !userId || !hours || hours <= 0) {
      return { error: '参数无效' }
    }

    await ensureLeaveBalance(userId)
    await prisma.leaveBalance.update({
      where: { userId },
      data: {
        compensatory: {
          increment: hours,
        },
      },
    })

    console.log(`管理员添加调休: userId=${userId}, hours=${hours}, reason=${String(reason || '')}`)

    revalidatePath('/dashboard/compensatory')
    return { success: `成功添加 ${hours} 小时调休` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '添加失败，请稍后重试' }
  }
}

export async function getAllCompensatoryInfo(departmentId?: string) {
  try {
    await requireAdminUser()

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
