'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { requireAdminUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import {
  calculateHourlyRate,
  calculateOvertimeAllocation,
  canGenerateSalary,
} from '@/lib/utils'
import { salaryGenerateSchema, salaryStatusSchema } from '@/lib/validations'
import { SALARY_CONSTANTS } from '@/types'

function buildSalaryRecordSummary<T extends {
  baseSalary: number
  workdayOvertimeHours: number
  weekendOvertimeHours: number
  holidayOvertimeHours: number
  compensatoryHours: number
}>(record: T, compensatoryHoursOverride?: number) {
  const hourlySalary = Math.round(calculateHourlyRate(record.baseSalary) * 100) / 100
  const paidOvertimeHours =
    record.workdayOvertimeHours + record.weekendOvertimeHours + record.holidayOvertimeHours
  const compensatoryOvertimeHours = compensatoryHoursOverride ?? record.compensatoryHours
  const totalOvertimeHours = paidOvertimeHours + compensatoryOvertimeHours

  return {
    hourlySalary,
    paidOvertimeHours,
    compensatoryOvertimeHours,
    totalOvertimeHours,
  }
}

function buildSalaryWhere(filters?: {
  month?: string
  departmentId?: string
  status?: string
  userId?: string
}): Prisma.SalaryRecordWhereInput {
  const where: Prisma.SalaryRecordWhereInput = {}

  if (filters?.month) {
    where.month = filters.month
  }

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.userId) {
    where.userId = filters.userId
  }

  if (filters?.departmentId) {
    where.user = {
      departmentId: filters.departmentId,
    }
  }

  return where
}

export async function getSalaryRecords(filters?: {
  month?: string
  departmentId?: string
  status?: string
  userId?: string
}) {
  try {
    await requireAdminUser()

    const records = await prisma.salaryRecord.findMany({
      where: buildSalaryWhere(filters),
      include: {
        user: {
          select: {
            name: true,
            email: true,
            level: true,
            department: {
              select: { name: true },
            },
            position: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    })

    return records.map((record) => ({
      ...record,
      userName: record.user.name,
      departmentName: record.user.department?.name,
      positionName: record.user.position?.name,
    }))
  } catch (error) {
    console.error('获取薪资记录失败:', error)
    return []
  }
}

export async function getSalaryRecord(id: string) {
  try {
    await requireAdminUser()

    const record = await prisma.salaryRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            level: true,
            department: {
              select: { name: true },
            },
            position: {
              select: { name: true },
            },
          },
        },
        overtimeSettlements: {
          include: {
            overtime: true,
          },
        },
      },
    })

    if (!record) {
      return null
    }

    const compensatorySettledHours = record.overtimeSettlements
      .filter((settlement) => settlement.settlementType === 'COMPENSATORY')
      .reduce((sum, settlement) => sum + settlement.hours, 0)

    return {
      ...record,
      userName: record.user.name,
      departmentName: record.user.department?.name,
      positionName: record.user.position?.name,
      ...buildSalaryRecordSummary(
        record,
        compensatorySettledHours > 0 ? compensatorySettledHours : undefined
      ),
    }
  } catch (error) {
    console.error('获取薪资记录详情失败:', error)
    return null
  }
}

export async function generateSalaryRecords(formData: FormData) {
  try {
    await requireAdminUser()

    const validatedData = salaryGenerateSchema.parse({
      month: formData.get('month'),
      departmentId: formData.get('departmentId') || undefined,
    })

    const { month, departmentId } = validatedData
    const checkResult = canGenerateSalary(month)
    if (!checkResult.canGenerate) {
      return { error: checkResult.message }
    }

    const userWhere: Prisma.UserWhereInput = {}
    if (departmentId) {
      userWhere.departmentId = departmentId
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        position: true,
        department: true,
      },
    })

    if (users.length === 0) {
      return { error: '没有找到符合条件的员工' }
    }

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59)

    let successCount = 0
    let skipCount = 0

    for (const user of users) {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.salaryRecord.findUnique({
          where: {
            userId_month: {
              userId: user.id,
              month,
            },
          },
        })

        if (existing) {
          return 'skipped' as const
        }

        const baseSalary = user.position?.salary ?? user.salary ?? 0
        if (!baseSalary) {
          console.log(`用户 ${user.name} 未设置薪资，已跳过`)
          return 'skipped' as const
        }

        const overtimeApplications = await tx.overtimeApplication.findMany({
          where: {
            userId: user.id,
            status: {
              in: ['APPROVED', 'COMPLETED'],
            },
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        })

        const overtimeByType = {
          WORKDAY: 0,
          WEEKEND: 0,
          HOLIDAY: 0,
        }

        for (const overtimeApplication of overtimeApplications) {
          overtimeByType[overtimeApplication.type as keyof typeof overtimeByType] += overtimeApplication.hours
        }

        const hourlyRate = calculateHourlyRate(baseSalary)
        const overtimeData = [
          { type: 'HOLIDAY' as const, hours: overtimeByType.HOLIDAY },
          { type: 'WEEKEND' as const, hours: overtimeByType.WEEKEND },
          { type: 'WORKDAY' as const, hours: overtimeByType.WORKDAY },
        ].filter((item) => item.hours > 0)
        const allocation = calculateOvertimeAllocation(overtimeData, hourlyRate)

        const leaveApplications = await tx.leaveApplication.findMany({
          where: {
            userId: user.id,
            status: {
              in: ['APPROVED', 'COMPLETED'],
            },
            type: 'PERSONAL',
            startDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        })

        const dailyRate = baseSalary / SALARY_CONSTANTS.WORKDAYS_PER_MONTH
        const personalLeaveDays = leaveApplications.reduce((sum, application) => sum + application.days, 0)
        const deduction = Math.round(personalLeaveDays * dailyRate * 100) / 100
        const netSalary = baseSalary + allocation.totalPay - deduction

        const salaryRecord = await tx.salaryRecord.create({
          data: {
            userId: user.id,
            month,
            baseSalary,
            workdayOvertimeHours: allocation.paidHours
              .filter((item) => item.type === 'WORKDAY')
              .reduce((sum, item) => sum + item.hours, 0),
            workdayOvertimePay: allocation.paidHours
              .filter((item) => item.type === 'WORKDAY')
              .reduce((sum, item) => sum + item.hours * hourlyRate * SALARY_CONSTANTS.WORKDAY_OVERTIME_RATE, 0),
            weekendOvertimeHours: allocation.paidHours
              .filter((item) => item.type === 'WEEKEND')
              .reduce((sum, item) => sum + item.hours, 0),
            weekendOvertimePay: allocation.paidHours
              .filter((item) => item.type === 'WEEKEND')
              .reduce((sum, item) => sum + item.hours * hourlyRate * SALARY_CONSTANTS.WEEKEND_OVERTIME_RATE, 0),
            holidayOvertimeHours: allocation.paidHours
              .filter((item) => item.type === 'HOLIDAY')
              .reduce((sum, item) => sum + item.hours, 0),
            holidayOvertimePay: allocation.paidHours
              .filter((item) => item.type === 'HOLIDAY')
              .reduce((sum, item) => sum + item.hours * hourlyRate * SALARY_CONSTANTS.HOLIDAY_OVERTIME_RATE, 0),
            totalOvertimePay: allocation.totalPay,
            compensatoryHours: allocation.compensatoryHours,
            deduction,
            netSalary,
            status: 'DRAFT',
          },
        })

        if (allocation.compensatoryHours > 0) {
          let remainingCompensatoryHours = allocation.compensatoryHours
          const sortedOvertime = [...overtimeApplications].sort((left, right) => {
            const priority = { WORKDAY: 0, WEEKEND: 1, HOLIDAY: 2 }
            return priority[left.type as keyof typeof priority] - priority[right.type as keyof typeof priority]
          })

          for (const overtimeApplication of sortedOvertime) {
            if (remainingCompensatoryHours <= 0) {
              break
            }

            const existingCompSettlement = await tx.overtimeSettlement.findFirst({
              where: {
                overtimeId: overtimeApplication.id,
                settlementType: 'COMPENSATORY',
              },
            })

            if (existingCompSettlement) {
              remainingCompensatoryHours -= Math.min(overtimeApplication.hours, remainingCompensatoryHours)
              continue
            }

            const hoursToSettle = Math.min(overtimeApplication.hours, remainingCompensatoryHours)
            await tx.overtimeSettlement.create({
              data: {
                userId: user.id,
                overtimeId: overtimeApplication.id,
                salaryRecordId: salaryRecord.id,
                hours: hoursToSettle,
                settlementType: 'COMPENSATORY',
              },
            })

            remainingCompensatoryHours -= hoursToSettle
          }

          const leaveBalance = await tx.leaveBalance.findUnique({
            where: { userId: user.id },
          })

          if (leaveBalance) {
            await tx.leaveBalance.update({
              where: { userId: user.id },
              data: {
                compensatory: {
                  increment: allocation.compensatoryHours,
                },
              },
            })
          }
        }

        for (const paid of allocation.paidHours) {
          const overtimeRecords = overtimeApplications.filter((application) => application.type === paid.type)
          let remainingHours = paid.hours

          for (const overtimeApplication of overtimeRecords) {
            if (remainingHours <= 0) {
              break
            }

            const existingSettlement = await tx.overtimeSettlement.findFirst({
              where: {
                overtimeId: overtimeApplication.id,
                settlementType: 'SALARY',
              },
            })

            if (existingSettlement) {
              continue
            }

            const hoursToSettle = Math.min(overtimeApplication.hours, remainingHours)
            await tx.overtimeSettlement.create({
              data: {
                userId: user.id,
                overtimeId: overtimeApplication.id,
                salaryRecordId: salaryRecord.id,
                hours: hoursToSettle,
                settlementType: 'SALARY',
              },
            })

            remainingHours -= hoursToSettle
          }
        }

        return 'created' as const
      })

      if (result === 'created') {
        successCount += 1
      } else {
        skipCount += 1
      }
    }

    revalidatePath('/dashboard/salary')
    return {
      success: `成功生成 ${successCount} 条薪资记录${
        skipCount > 0 ? `，跳过 ${skipCount} 条（已存在或未设置薪资）` : ''
      }`,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '生成失败，请稍后重试' }
  }
}

export async function updateSalaryStatus(formData: FormData) {
  try {
    await requireAdminUser()

    const validatedData = salaryStatusSchema.parse({
      salaryId: formData.get('salaryId'),
      status: formData.get('status'),
    })

    const updateData: Prisma.SalaryRecordUpdateInput = {
      status: validatedData.status,
    }

    if (validatedData.status === 'PAID') {
      updateData.paidAt = new Date()
    }

    await prisma.salaryRecord.update({
      where: { id: validatedData.salaryId },
      data: updateData,
    })

    revalidatePath('/dashboard/salary')
    return { success: '状态更新成功' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function deleteSalaryRecord(id: string) {
  try {
    await requireAdminUser()

    const record = await prisma.salaryRecord.findUnique({
      where: { id },
    })

    if (!record) {
      return { error: '薪资记录不存在' }
    }

    if (record.status !== 'DRAFT') {
      return { error: '只有草稿状态的薪资记录可以删除' }
    }

    await prisma.$transaction(async (tx) => {
      const compensatorySettlements = await tx.overtimeSettlement.findMany({
        where: {
          salaryRecordId: id,
          settlementType: 'COMPENSATORY',
        },
        select: {
          hours: true,
        },
      })

      const compensatoryHours = compensatorySettlements.reduce((sum, settlement) => sum + settlement.hours, 0)

      await tx.overtimeSettlement.deleteMany({
        where: { salaryRecordId: id },
      })

      if (compensatoryHours > 0) {
        const leaveBalance = await tx.leaveBalance.findUnique({
          where: { userId: record.userId },
        })

        if (leaveBalance) {
          await tx.leaveBalance.update({
            where: { userId: record.userId },
            data: {
              compensatory: {
                decrement: compensatoryHours,
              },
            },
          })
        }
      }

      await tx.salaryRecord.delete({
        where: { id },
      })
    })

    revalidatePath('/dashboard/salary')
    return { success: '薪资记录已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function getAvailableMonths() {
  await requireAdminUser()

  const now = new Date()
  const months: string[] = []

  for (let i = 1; i <= 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const check = canGenerateSalary(month)

    if (check.canGenerate) {
      months.push(month)
    }
  }

  return months
}

export async function getSalaryMonths() {
  try {
    await requireAdminUser()

    const records = await prisma.salaryRecord.findMany({
      distinct: ['month'],
      select: {
        month: true,
      },
      orderBy: {
        month: 'desc',
      },
    })

    return records.map((record) => record.month)
  } catch (error) {
    console.error('获取薪资月份列表失败:', error)
    return []
  }
}

export async function getSalaryExportData(filters?: {
  month?: string
  departmentId?: string
  status?: string
}) {
  try {
    await requireAdminUser()

    if (!filters?.month) {
      return []
    }

    const records = await getSalaryRecords(filters)

    return records.map((record) => ({
      员工编号: record.userId,
      姓名: record.userName,
      部门: record.departmentName || '',
      岗位: record.positionName || '',
      职级: record.user.level || '',
      月份: record.month,
      薪资: record.netSalary,
      工作日加班工资: record.workdayOvertimePay,
      工作日加班时长: record.workdayOvertimeHours,
      周末加班工资: record.weekendOvertimePay,
      周末加班时长: record.weekendOvertimeHours,
      法定节假日加班工资: record.holidayOvertimePay,
      加班时长:
        record.workdayOvertimeHours + record.weekendOvertimeHours + record.holidayOvertimeHours,
      调休时长: record.compensatoryHours,
    }))
  } catch (error) {
    console.error('导出薪资数据失败:', error)
    return []
  }
}

export async function getSalaryStats(month?: string) {
  try {
    await requireAdminUser()

    const where: Prisma.SalaryRecordWhereInput = month ? { month } : {}
    const stats = await prisma.salaryRecord.aggregate({
      where,
      _count: true,
      _sum: {
        baseSalary: true,
        totalOvertimePay: true,
        deduction: true,
        netSalary: true,
        compensatoryHours: true,
      },
    })

    const statusCounts = await prisma.salaryRecord.groupBy({
      by: ['status'],
      where,
      _count: true,
    })

    return {
      totalRecords: stats._count,
      totalBaseSalary: stats._sum.baseSalary || 0,
      totalOvertimePay: stats._sum.totalOvertimePay || 0,
      totalDeduction: stats._sum.deduction || 0,
      totalNetSalary: stats._sum.netSalary || 0,
      totalCompensatoryHours: stats._sum.compensatoryHours || 0,
      statusBreakdown: statusCounts.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    }
  } catch (error) {
    console.error('获取薪资统计失败:', error)
    return null
  }
}
