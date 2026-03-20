'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { requireSelfOrAdmin, requireSessionUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { calculateLeaveDaysExcludingNonWorkingDays, formatDateKey } from '@/lib/utils'
import { leaveSchema } from '@/lib/validations'
import { SALARY_CONSTANTS } from '@/types'

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPENSATORY: '调休',
}

function getCurrentYear() {
  return new Date().getFullYear()
}

async function getOrCreateLeaveBalance(userId: string) {
  let balance = await prisma.leaveBalance.findUnique({
    where: { userId },
  })

  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: {
        userId,
        year: getCurrentYear(),
        annual: 5,
        sick: 10,
        personal: 5,
        compensatory: 0,
        usedCompensatory: 0,
      },
    })
  }

  return balance
}

async function getPendingCompensatoryHours(userId: string, excludeId?: string) {
  const applications = await prisma.leaveApplication.findMany({
    where: {
      userId,
      type: 'COMPENSATORY',
      status: 'PENDING',
      id: excludeId
        ? {
            not: excludeId,
          }
        : undefined,
    },
    select: {
      days: true,
    },
  })

  return applications.reduce((sum, application) => sum + application.days * SALARY_CONSTANTS.HOURS_PER_DAY, 0)
}

async function getHolidayDateBuckets(startDate: Date, endDate: Date) {
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
        lte: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59),
      },
    },
    select: {
      date: true,
      type: true,
    },
  })

  return {
    legalHolidayDates: holidays
      .filter((holiday) => holiday.type === 'LEGAL_HOLIDAY')
      .map((holiday) => formatDateKey(new Date(holiday.date))),
    compensatoryWorkDates: holidays
      .filter((holiday) => holiday.type === 'COMPENSATORY')
      .map((holiday) => formatDateKey(new Date(holiday.date))),
  }
}

function buildLeavePayload(formData: FormData) {
  const validatedData = leaveSchema.parse({
    type: formData.get('type'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    destination: formData.get('destination'),
    reason: formData.get('reason'),
  })

  const startDateTime = new Date(validatedData.startDate)
  const endDateTime = new Date(validatedData.endDate)

  return {
    validatedData,
    startDateTime,
    endDateTime,
  }
}

async function validateLeaveBalance(params: {
  userId: string
  leaveType: string
  days: number
  isCompensatory: boolean
  excludeId?: string
}) {
  const balance = await getOrCreateLeaveBalance(params.userId)

  if (params.isCompensatory) {
    const pendingCompensatoryHours = await getPendingCompensatoryHours(params.userId, params.excludeId)
    const availableCompensatory =
      (balance.compensatory || 0) - (balance.usedCompensatory || 0) - pendingCompensatoryHours

    if (availableCompensatory < params.days * SALARY_CONSTANTS.HOURS_PER_DAY) {
      return { error: `调休余额不足，当前可用 ${availableCompensatory} 小时` }
    }

    return { balance }
  }

  let currentBalance = 0
  if (params.leaveType === 'ANNUAL') {
    currentBalance = balance.annual
  } else if (params.leaveType === 'SICK') {
    currentBalance = balance.sick
  } else if (params.leaveType === 'PERSONAL') {
    currentBalance = balance.personal
  }

  if (
    params.days > currentBalance &&
    params.leaveType !== 'MARRIAGE' &&
    params.leaveType !== 'MATERNITY' &&
    params.leaveType !== 'PATERNITY'
  ) {
    return { error: `假期余额不足，当前剩余 ${currentBalance} 天` }
  }

  return { balance }
}

async function requireLeaveOwnerOrAdmin(id: string) {
  const sessionUser = await requireSessionUser()
  const application = await prisma.leaveApplication.findUnique({
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
    throw new Error('无权操作该请假申请')
  }

  return {
    sessionUser,
    application,
  }
}

export async function getLeaveDurationPreview(startDate?: string, endDate?: string) {
  try {
    await requireSessionUser()

    if (!startDate || !endDate) {
      return { days: 0 }
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return { days: 0 }
    }

    const holidayBuckets = await getHolidayDateBuckets(start, end)
    const days = calculateLeaveDaysExcludingNonWorkingDays(start, end, holidayBuckets)

    return { days }
  } catch (error) {
    console.error('获取请假天数预览失败:', error)
    return { days: 0 }
  }
}

export async function createLeaveApplication(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const action = formData.get('action') === 'submit' ? 'submit' : 'save'
    const payload = buildLeavePayload(formData)
    const holidayBuckets = await getHolidayDateBuckets(payload.startDateTime, payload.endDateTime)
    const days = calculateLeaveDaysExcludingNonWorkingDays(payload.startDateTime, payload.endDateTime, holidayBuckets)

    if (days <= 0) {
      return { error: '所选日期不包含有效工作日，请重新选择' }
    }

    if (action === 'submit') {
      const balanceCheck = await validateLeaveBalance({
        userId: sessionUser.id,
        leaveType: payload.validatedData.type,
        days,
        isCompensatory: payload.validatedData.type === 'COMPENSATORY',
      })

      if (balanceCheck.error) {
        return { error: balanceCheck.error }
      }
    }

    const created = await prisma.leaveApplication.create({
      data: {
        userId: sessionUser.id,
        type: payload.validatedData.type,
        startDate: payload.startDateTime,
        endDate: payload.endDateTime,
        days,
        reason: payload.validatedData.reason,
        destination: payload.validatedData.destination,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/compensatory')

    const applicationLabel = payload.validatedData.type === 'COMPENSATORY' ? '调休申请' : '请假申请'

    return {
      success: action === 'submit' ? `${applicationLabel}已提交` : `${applicationLabel.replace('申请', '')}草稿已保存`,
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
    const sessionUser = await requireSessionUser()
    const application = await prisma.leaveApplication.findUnique({
      where: { id },
    })

    if (!application) {
      return null
    }

    if (sessionUser.role === 'EMPLOYEE' && application.userId !== sessionUser.id) {
      return null
    }

    return application
  } catch (error) {
    console.error('获取请假申请详情失败:', error)
    return null
  }
}

export async function deleteLeaveApplication(id: string) {
  try {
    if (!id) {
      return { error: '缺少请假申请 ID' }
    }

    const { application } = await requireLeaveOwnerOrAdmin(id)

    if (!application) {
      return { error: '请假申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的请假申请可以删除' }
    }

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'LEAVE',
        },
      }),
      prisma.leaveApplication.delete({
        where: { id },
      }),
    ])

    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/compensatory')
    return { success: '请假申请已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function updateLeaveApplication(formData: FormData) {
  try {
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
      return { error: '缺少请假申请 ID' }
    }

    const { application } = await requireLeaveOwnerOrAdmin(id)

    if (!application) {
      return { error: '请假申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的请假申请可以修改' }
    }

    const payload = buildLeavePayload(formData)
    const holidayBuckets = await getHolidayDateBuckets(payload.startDateTime, payload.endDateTime)
    const days = calculateLeaveDaysExcludingNonWorkingDays(payload.startDateTime, payload.endDateTime, holidayBuckets)
    const nextStatus = formData.get('action') === 'submit' ? 'PENDING' : 'DRAFT'

    if (days <= 0) {
      return { error: '所选日期不包含有效工作日，请重新选择' }
    }

    if (nextStatus === 'PENDING') {
      const balanceCheck = await validateLeaveBalance({
        userId: application.userId,
        leaveType: payload.validatedData.type,
        days,
        isCompensatory: payload.validatedData.type === 'COMPENSATORY',
        excludeId: id,
      })

      if (balanceCheck.error) {
        return { error: balanceCheck.error }
      }
    }

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'LEAVE',
        },
      }),
      prisma.leaveApplication.update({
        where: { id },
        data: {
          type: payload.validatedData.type,
          startDate: payload.startDateTime,
          endDate: payload.endDateTime,
          days,
          reason: payload.validatedData.reason,
          destination: payload.validatedData.destination,
          status: nextStatus,
          approverId: null,
          approvedAt: null,
          remark: null,
        },
      }),
    ])

    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/compensatory')

    const applicationLabel = payload.validatedData.type === 'COMPENSATORY' ? '调休申请' : '请假申请'
    return {
      success: nextStatus === 'PENDING' ? `${applicationLabel}已提交` : `${applicationLabel}已保存为草稿`,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function getLeaveApplications(_userId?: string, _role?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const where: Prisma.LeaveApplicationWhereInput =
      sessionUser.role === 'EMPLOYEE'
        ? {
            userId: sessionUser.id,
          }
        : {}

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

    return applications.map((application) => ({
      ...application,
      userName: application.user.name,
      leaveTypeText: leaveTypeMap[application.type] || application.type,
      compensatoryHours:
        application.type === 'COMPENSATORY' ? application.days * SALARY_CONSTANTS.HOURS_PER_DAY : 0,
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

    await requireSelfOrAdmin(userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return null
    }

    return await getOrCreateLeaveBalance(userId)
  } catch (error) {
    console.error('获取假期余额失败:', error)
    return null
  }
}

export async function getLeaveStats(userId?: string, departmentId?: string, referenceMonth?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const now = new Date()
    const [year, month] = referenceMonth
      ? referenceMonth.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1]
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59)

    const where: Prisma.LeaveApplicationWhereInput = {
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

    const applications = await prisma.leaveApplication.findMany({
      where,
      select: {
        days: true,
        startDate: true,
        endDate: true,
      },
    })

    let totalDays = 0
    for (const application of applications) {
      const leaveStart = new Date(application.startDate)
      const leaveEnd = new Date(application.endDate)

      const effectiveStart = leaveStart < firstDayOfMonth ? firstDayOfMonth : leaveStart
      const effectiveEnd = leaveEnd > lastDayOfMonth ? lastDayOfMonth : leaveEnd

      const msPerDay = 24 * 60 * 60 * 1000
      const overlapDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / msPerDay) + 1
      const totalLeaveDays = (leaveEnd.getTime() - leaveStart.getTime()) / msPerDay + 1
      const ratio = overlapDays / totalLeaveDays
      totalDays += application.days * ratio
    }

    return Math.round(totalDays * 2) / 2
  } catch (error) {
    console.error('获取请假统计失败:', error)
    return 0
  }
}
