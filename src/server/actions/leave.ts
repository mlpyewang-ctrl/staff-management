'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { isAttendanceClerk, isEmployeeRole, requireAttendanceClerk, requireSelfOrAdmin, requireSessionUser } from '@/lib/action-auth'
import { ensureLeaveBalance } from '@/lib/leave-balance'
import { prisma } from '@/lib/prisma'
import { calculateLeaveDaysExcludingNonWorkingDays, formatDateKey } from '@/lib/utils'
import { leaveSchema } from '@/lib/validations'
import { SALARY_CONSTANTS } from '@/types'
import type { ParsedLeaveRow } from '@/lib/excel-parser'

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPENSATORY: '调休',
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
  const getString = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : undefined
  }

  const legacyHalfDaySession = getString('halfDaySession')
  const validatedData = leaveSchema.parse({
    type: getString('type'),
    startSession: getString('startSession') ?? legacyHalfDaySession,
    endSession: getString('endSession') ?? legacyHalfDaySession,
    startDate: getString('startDate'),
    endDate: getString('endDate'),
    destination: getString('destination'),
    reason: getString('reason'),
  })

  const startDateTime = new Date(validatedData.startDate)
  const endDateTime = new Date(validatedData.endDate)
  const startSession = validatedData.startSession || 'AM'
  const endSession = validatedData.endSession || 'PM'

  if (
    formatDateKey(startDateTime) === formatDateKey(endDateTime) &&
    startSession === 'PM' &&
    endSession === 'AM'
  ) {
    throw new Error('同一天请假的结束时段不能早于开始时段')
  }

  return {
    validatedData,
    startDateTime,
    endDateTime,
    startSession,
    endSession,
  }
}

async function validateLeaveBalance(params: {
  userId: string
  leaveType: string
  days: number
  isCompensatory: boolean
  excludeId?: string
}) {
  const balance = await ensureLeaveBalance(params.userId)

  if (params.isCompensatory) {
    const pendingCompensatoryHours = await getPendingCompensatoryHours(params.userId, params.excludeId)
    const availableCompensatory =
      (balance.compensatory || 0) - (balance.usedCompensatory || 0) - pendingCompensatoryHours

    if (availableCompensatory < params.days * SALARY_CONSTANTS.HOURS_PER_DAY) {
      return { error: `调休余额不足，当前可用 ${availableCompensatory} 小时` }
    }

    return { balance }
  }

  if (params.leaveType === 'ANNUAL' && params.days > balance.annual) {
    return { error: `年假余额不足，当前剩余 ${balance.annual} 天` }
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
      approverId: true,
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

export async function getLeaveDurationPreview(
  startDate?: string,
  endDate?: string,
  startSession?: string,
  endSession?: string
) {
  try {
    await requireSessionUser()
    const normalizedStartSession = startSession === 'PM' ? 'PM' : 'AM'
    const normalizedEndSession = endSession === 'AM' ? 'AM' : 'PM'

    if (!startDate || !endDate) {
      return { days: 0 }
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return { days: 0 }
    }

    const holidayBuckets = await getHolidayDateBuckets(start, end)
    const days = calculateLeaveDaysExcludingNonWorkingDays(start, end, {
      ...holidayBuckets,
      startSession: normalizedStartSession,
      endSession: normalizedEndSession,
    })

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
    const days = calculateLeaveDaysExcludingNonWorkingDays(payload.startDateTime, payload.endDateTime, {
      ...holidayBuckets,
      startSession: payload.startSession,
      endSession: payload.endSession,
    })

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
        startSession: payload.startSession || null,
        endSession: payload.endSession || null,
        halfDaySession: null,
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

    const sessionUser = await requireSessionUser()
    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            departmentId: true,
          },
        },
      },
    })

    if (!application) {
      return { error: '请假申请不存在' }
    }

    const isOwner = sessionUser.id === application.userId
    const isAdmin = sessionUser.role === 'ADMIN'
    const isClerkDeletingImport =
      isAttendanceClerk(sessionUser.role) &&
      application.status === 'COMPLETED' &&
      application.approverId === null

    if (!isOwner && !isAdmin && !isClerkDeletingImport) {
      return { error: '无权操作该请假申请' }
    }

    if (application.status !== 'DRAFT' && !isAdmin && !isClerkDeletingImport) {
      return { error: '只有草稿状态的请假申请可以删除' }
    }

    await prisma.$transaction(async (tx) => {
      // 如果是导入的已完成请假，删除时恢复余额
      if (isClerkDeletingImport && ['ANNUAL', 'COMPENSATORY'].includes(application.type)) {
        const balance = await tx.leaveBalance.findFirst({
          where: {
            userId: application.userId,
            year: new Date().getFullYear(),
          },
        })

        if (balance) {
          const updateData: Record<string, { increment: number } | { decrement: number }> = {}
          if (application.type === 'ANNUAL') {
            updateData.annual = { increment: application.days }
          } else if (application.type === 'COMPENSATORY') {
            updateData.usedCompensatory = { decrement: application.days * SALARY_CONSTANTS.HOURS_PER_DAY }
          }

          if (Object.keys(updateData).length > 0) {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: updateData,
            })
          }
        }
      }

      await tx.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'LEAVE',
        },
      })
      await tx.leaveApplication.delete({
        where: { id },
      })
    })

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
    const days = calculateLeaveDaysExcludingNonWorkingDays(payload.startDateTime, payload.endDateTime, {
      ...holidayBuckets,
      startSession: payload.startSession,
      endSession: payload.endSession,
    })
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
          startSession: payload.startSession || null,
          endSession: payload.endSession || null,
          halfDaySession: null,
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
    const where: Prisma.LeaveApplicationWhereInput = {
      userId: sessionUser.id,
    }

    const applications = await prisma.leaveApplication.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            username: true,
            leaveBalance: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return applications.map((application) => ({
      ...application,
      userName: application.user.name,
      leaveTypeText: leaveTypeMap[application.type] || application.type,
      startSession: application.startSession || application.halfDaySession || null,
      endSession: application.endSession || application.halfDaySession || null,
      halfDaySession: application.halfDaySession,
      compensatoryHours:
        application.type === 'COMPENSATORY' ? application.days * SALARY_CONSTANTS.HOURS_PER_DAY : 0,
      applicantAnnual: application.user.leaveBalance?.annual ?? null,
      applicantAnnualEntitlement: application.user.leaveBalance?.annualEntitlement ?? null,
      applicantCompensatory: application.user.leaveBalance?.compensatory ?? null,
      applicantUsedCompensatory: application.user.leaveBalance?.usedCompensatory ?? null,
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

    return await ensureLeaveBalance(userId)
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


// ===== 批量导入请假 =====

export async function batchImportLeave(rows: ParsedLeaveRow[]) {
  try {
    await requireAttendanceClerk()

    if (!rows || rows.length === 0) {
      return { error: '没有数据需要导入' }
    }

    const usernames = Array.from(new Set(rows.map((r) => r.username)))
    const users = await prisma.user.findMany({
      where: {
        username: {
          in: usernames,
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
      },
    })

    const userMap = new Map(users.map((u) => [u.username, u]))
    const errors: Array<{ rowIndex: number; message: string }> = []

    for (const row of rows) {
      const user = userMap.get(row.username)
      if (!user) {
        errors.push({ rowIndex: row.rowIndex, message: `用户 "${row.username}" 不存在` })
      } else if (user.name !== row.name && row.name) {
        errors.push({ rowIndex: row.rowIndex, message: `用户 "${row.username}" 的姓名不匹配（系统中为 ${user.name}）` })
      }
    }

    if (errors.length > 0) {
      return { error: '数据校验失败', errors }
    }

    const now = new Date()

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const user = userMap.get(row.username)!
        const startDateTime = new Date(row.startDate)
        const endDateTime = new Date(row.endDate)
        const startSession = row.startSession || 'AM'
        const endSession = row.endSession || 'PM'

        if (
          formatDateKey(startDateTime) === formatDateKey(endDateTime) &&
          startSession === 'PM' &&
          endSession === 'AM'
        ) {
          throw new Error(`第 ${row.rowIndex} 行：同一天请假的结束时段不能早于开始时段`)
        }

        const holidays = await tx.holiday.findMany({
          where: {
            date: {
              gte: new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate()),
              lte: new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate(), 23, 59, 59),
            },
          },
          select: {
            date: true,
            type: true,
          },
        })

        const legalHolidayDates = holidays
          .filter((h) => h.type === 'LEGAL_HOLIDAY')
          .map((h) => formatDateKey(new Date(h.date)))
        const compensatoryWorkDates = holidays
          .filter((h) => h.type === 'COMPENSATORY')
          .map((h) => formatDateKey(new Date(h.date)))

        const days = calculateLeaveDaysExcludingNonWorkingDays(startDateTime, endDateTime, {
          legalHolidayDates,
          compensatoryWorkDates,
          startSession,
          endSession,
        })

        if (days <= 0) {
          throw new Error(`第 ${row.rowIndex} 行：所选日期不包含有效工作日`)
        }

        const leaveType = row.type
        const isCompensatory = leaveType === 'COMPENSATORY'

        const balance = await tx.leaveBalance.findFirst({
          where: {
            userId: user.id,
            year: now.getFullYear(),
          },
        })

        if (!balance) {
          throw new Error(`第 ${row.rowIndex} 行：用户 ${row.username} 没有假期余额记录`)
        }

        if (isCompensatory) {
          const availableCompensatory = (balance.compensatory || 0) - (balance.usedCompensatory || 0)
          if (availableCompensatory < days * SALARY_CONSTANTS.HOURS_PER_DAY) {
            throw new Error(`第 ${row.rowIndex} 行：用户 ${row.username} 调休余额不足，当前可用 ${availableCompensatory} 小时`)
          }
        } else if (leaveType === 'ANNUAL' && days > balance.annual) {
          throw new Error(`第 ${row.rowIndex} 行：用户 ${row.username} 年假余额不足，当前剩余 ${balance.annual} 天`)
        }

        await tx.leaveApplication.create({
          data: {
            userId: user.id,
            type: leaveType,
            startSession: startSession || null,
            endSession: endSession || null,
            halfDaySession: null,
            startDate: startDateTime,
            endDate: endDateTime,
            days,
            reason: row.reason,
            destination: row.destination || null,
            status: 'COMPLETED',
            approverId: null,
            approvedAt: now,
          },
        })

        const balanceUpdate: Record<string, { decrement: number } | { increment: number }> = {}
        if (leaveType === 'ANNUAL') {
          balanceUpdate.annual = { decrement: days }
        } else if (leaveType === 'COMPENSATORY') {
          balanceUpdate.usedCompensatory = { increment: days * SALARY_CONSTANTS.HOURS_PER_DAY }
        }

        if (Object.keys(balanceUpdate).length > 0) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: balanceUpdate,
          })
        }
      }
    })

    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/compensatory')
    return { success: `成功导入 ${rows.length} 条请假记录` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '导入失败，请稍后重试' }
  }
}
