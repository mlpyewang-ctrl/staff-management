'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { requireAdminUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { buildSalaryExportRows } from '@/lib/salary-export'
import { calculateSeniorityPay } from '@/lib/seniority'

import {
  calculateHourlyRate,
  calculateLeaveDaysInMonth,
  calculateOvertimeAllocation,
  canGenerateSalary,
  formatDateKey,
} from '@/lib/utils'
import {
  salaryBatchAdjustmentSchema,
  salaryGenerateSchema,
  salaryStatusSchema,
} from '@/lib/validations'
import { SALARY_CONSTANTS } from '@/types'

function buildSalaryRecordSummary<T extends {
  baseSalary: number
  seniorityPay: number
  otherAdjustment: number
  classLeaderAllowance: number
  dormHeadAllowance: number
  electricityAllowance: number
  supplementalPay: number
  deductionAdjustment: number
  workdayOvertimeHours: number
  weekendOvertimeHours: number
  holidayOvertimeHours: number
  compensatoryHours: number
  totalOvertimePay: number
  deduction: number
}>(record: T, compensatoryHoursOverride?: number) {
  // 计薪基数 = 基本工资 + 工龄工资，用于计算时薪
  const salaryBase = record.baseSalary + record.seniorityPay
  const hourlySalary = Math.round(calculateHourlyRate(salaryBase) * 100) / 100
  const paidOvertimeHours =
    record.workdayOvertimeHours + record.weekendOvertimeHours + record.holidayOvertimeHours
  const compensatoryOvertimeHours = compensatoryHoursOverride ?? record.compensatoryHours
  const totalOvertimeHours = paidOvertimeHours + compensatoryOvertimeHours
  const netSalary = buildNetSalary(record)

  return {
    salaryBase,
    hourlySalary,
    paidOvertimeHours,
    compensatoryOvertimeHours,
    totalOvertimeHours,
    netSalary,
  }
}

function buildNetSalary(params: {
  baseSalary: number
  seniorityPay: number
  otherAdjustment: number
  classLeaderAllowance?: number
  dormHeadAllowance?: number
  electricityAllowance?: number
  supplementalPay?: number
  totalOvertimePay: number
  deduction: number
  deductionAdjustment?: number
}) {
  const allowances =
    (params.classLeaderAllowance ?? 0) +
    (params.dormHeadAllowance ?? 0) +
    (params.electricityAllowance ?? 0) +
    (params.supplementalPay ?? 0)
  const totalDeduction = params.deduction + (params.deductionAdjustment ?? 0)

  return params.baseSalary + params.seniorityPay + params.otherAdjustment + allowances + params.totalOvertimePay - totalDeduction
}

function getMonthEndDate(month: string) {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(year, monthNum, 0, 23, 59, 59)
}

function normalizeSalaryRecord<T extends {
  month: string
  baseSalary: number
  seniorityPay?: number | null
  otherAdjustment?: number | null
  classLeaderAllowance?: number | null
  dormHeadAllowance?: number | null
  electricityAllowance?: number | null
  supplementalPay?: number | null
  deductionAdjustment?: number | null
  totalOvertimePay: number
  deduction: number
  user?: {
    startDate?: Date | null
    salary?: number | null
    educationSalary?: number | null
    position?: {
      baseSalary?: number | null
      hasSeniorityPay?: boolean | null
      seniorityPayPerYear?: number | null
      maxSeniorityPay?: number | null
    } | null
  } | null
}>(record: T) {
  const expectedBaseSalary = (record.user?.position?.baseSalary ?? record.user?.salary ?? 0) + (record.user?.educationSalary ?? 0)
  const expectedSeniorityPay = calculateSeniorityPay(
    record.user?.startDate,
    getMonthEndDate(record.month),
    record.user?.position?.seniorityPayPerYear,
    record.user?.position?.maxSeniorityPay,
    record.user?.position?.hasSeniorityPay
  )
  const currentSeniorityPay = record.seniorityPay ?? 0
  let baseSalary = record.baseSalary
  let seniorityPay = currentSeniorityPay

  if (currentSeniorityPay === 0 && expectedSeniorityPay > 0) {
    const combinedBaseSalary = expectedBaseSalary + expectedSeniorityPay

    if (Math.abs(record.baseSalary - combinedBaseSalary) < 0.01) {
      baseSalary = expectedBaseSalary
      seniorityPay = expectedSeniorityPay
    } else if (Math.abs(record.baseSalary - expectedBaseSalary) < 0.01) {
      baseSalary = expectedBaseSalary
      seniorityPay = expectedSeniorityPay
    }
  } else if (Math.abs(currentSeniorityPay - expectedSeniorityPay) > 0.01) {
    // 员工信息发生变更（如入职日期修改），校正工龄工资并保持计薪基数总和不变
    baseSalary = record.baseSalary + currentSeniorityPay - expectedSeniorityPay
    seniorityPay = expectedSeniorityPay
  }

  const otherAdjustment = record.otherAdjustment ?? 0
  const classLeaderAllowance = record.classLeaderAllowance ?? 0
  const dormHeadAllowance = record.dormHeadAllowance ?? 0
  const electricityAllowance = record.electricityAllowance ?? 0
  const supplementalPay = record.supplementalPay ?? 0
  const deductionAdjustment = record.deductionAdjustment ?? 0
  const netSalary = buildNetSalary({
    baseSalary,
    seniorityPay,
    otherAdjustment,
    classLeaderAllowance,
    dormHeadAllowance,
    electricityAllowance,
    supplementalPay,
    totalOvertimePay: record.totalOvertimePay,
    deduction: record.deduction,
    deductionAdjustment,
  })

  return {
    ...record,
    baseSalary,
    seniorityPay,
    otherAdjustment,
    classLeaderAllowance,
    dormHeadAllowance,
    electricityAllowance,
    supplementalPay,
    deductionAdjustment,
    netSalary,
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
            username: true,
            startDate: true,
            salary: true,
            educationSalary: true,
            level: true,
            department: {
              select: { name: true },
            },
            position: {
              select: { name: true, baseSalary: true, hasSeniorityPay: true, seniorityPayPerYear: true, maxSeniorityPay: true },
            },
          },
        },
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    })

    return records.map((record) => {
      const normalizedRecord = normalizeSalaryRecord(record)

      return {
        ...normalizedRecord,
        userName: record.user.name,
        departmentName: record.user.department?.name,
        positionName: record.user.position?.name,
        educationSalary: record.user.educationSalary ?? 0,
      }
    })
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
            username: true,
            startDate: true,
            salary: true,
            educationSalary: true,
            level: true,
            department: {
              select: { name: true },
            },
            position: {
              select: { name: true, baseSalary: true, hasSeniorityPay: true, seniorityPayPerYear: true, maxSeniorityPay: true },
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

    const normalizedRecord = normalizeSalaryRecord(record)

    return {
      ...normalizedRecord,
      userName: record.user.name,
      departmentName: record.user.department?.name,
      positionName: record.user.position?.name,
      ...buildSalaryRecordSummary(
        normalizedRecord,
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

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        isOffDay: true,
      },
    })

    const legalHolidayDates = holidays
      .filter((h) => h.isOffDay)
      .map((h) => formatDateKey(new Date(h.date)))
    const compensatoryWorkDates = holidays
      .filter((h) => !h.isOffDay)
      .map((h) => formatDateKey(new Date(h.date)))

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

        if (existing && existing.status !== 'DRAFT') {
          // 已确认或已发放的薪资记录不能覆盖
          return 'skipped' as const
        }

        // 如存在草稿记录，先删除并清理关联数据
        if (existing) {
          const compensatorySettlements = await tx.overtimeSettlement.findMany({
            where: {
              salaryRecordId: existing.id,
              settlementType: 'COMPENSATORY',
            },
            select: { hours: true },
          })
          const compensatoryHours = compensatorySettlements.reduce((sum, s) => sum + s.hours, 0)

          await tx.overtimeSettlement.deleteMany({
            where: { salaryRecordId: existing.id },
          })

          if (compensatoryHours > 0) {
            const leaveBalance = await tx.leaveBalance.findUnique({
              where: { userId: user.id },
            })
            if (leaveBalance) {
              await tx.leaveBalance.update({
                where: { userId: user.id },
                data: {
                  compensatory: { decrement: compensatoryHours },
                },
              })
            }
          }

          await tx.salaryRecord.delete({
            where: { id: existing.id },
          })
        }

        const baseMonthlySalary = (user.position?.baseSalary ?? user.salary ?? 0) + (user.educationSalary ?? 0)
        if (!baseMonthlySalary) {
          console.log(`用户 ${user.name} 未设置薪资，已跳过`)
          return 'skipped' as const
        }

        const seniorityPay = calculateSeniorityPay(
          user.startDate,
          endDate,
          user.position?.seniorityPayPerYear,
          user.position?.maxSeniorityPay,
          user.position?.hasSeniorityPay
        )
        const baseSalary = baseMonthlySalary
        const otherAdjustment = 0
        const classLeaderAllowance = 0
        const dormHeadAllowance = 0
        const electricityAllowance = 0
        const supplementalPay = 0
        const deductionAdjustment = 0

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

        // 计薪基数 = 基本工资 + 工龄工资，用于计算时薪
        const salaryBase = baseSalary + seniorityPay
        const hourlyRate = calculateHourlyRate(salaryBase)
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
              lte: endDate,
            },
            endDate: {
              gte: startDate,
            },
          },
        })

        const dailyRate = baseSalary / SALARY_CONSTANTS.WORKDAYS_PER_MONTH
        const personalLeaveDays = leaveApplications.reduce((sum, application) => {
          const daysInMonth = calculateLeaveDaysInMonth(
            application.startDate,
            application.endDate,
            application.startSession,
            application.endSession,
            startDate,
            endDate,
            { legalHolidayDates, compensatoryWorkDates }
          )
          return sum + daysInMonth
        }, 0)
        const deduction = Math.round(personalLeaveDays * dailyRate * 100) / 100
        const netSalary = buildNetSalary({
          baseSalary,
          seniorityPay,
          otherAdjustment,
          classLeaderAllowance,
          dormHeadAllowance,
          electricityAllowance,
          supplementalPay,
          totalOvertimePay: allocation.totalPay,
          deduction,
          deductionAdjustment,
        })

        const salaryRecord = await tx.salaryRecord.create({
          data: {
            userId: user.id,
            month,
            baseSalary,
            seniorityPay,
            otherAdjustment,
            classLeaderAllowance,
            dormHeadAllowance,
            electricityAllowance,
            supplementalPay,
            deductionAdjustment,
            adjustmentNote: null,
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

export async function applySalaryBatchAdjustment(formData: FormData) {
  try {
    await requireAdminUser()

    const recordIds = formData.getAll('recordIds') as string[]
    const validatedData = salaryBatchAdjustmentSchema.parse({
      recordIds,
      field: formData.get('field'),
      amount: formData.get('amount'),
      note: formData.get('note') || undefined,
    })

    const amount = Number(validatedData.amount)
    const field = validatedData.field as keyof Prisma.SalaryRecordUpdateInput

    const records = await prisma.salaryRecord.findMany({
      where: {
        id: { in: validatedData.recordIds },
        status: 'DRAFT',
      },
      select: {
        id: true,
        baseSalary: true,
        seniorityPay: true,
        otherAdjustment: true,
        classLeaderAllowance: true,
        dormHeadAllowance: true,
        electricityAllowance: true,
        supplementalPay: true,
        deductionAdjustment: true,
        totalOvertimePay: true,
        deduction: true,
      },
    })

    if (records.length === 0) {
      return { error: '未找到可调整的草稿薪资记录' }
    }

    if (records.length !== validatedData.recordIds.length) {
      return { error: '部分记录不是草稿状态，无法调整' }
    }

    await prisma.$transaction(
      records.map((record) => {
        const currentValue = (record[validatedData.field] as number) ?? 0
        const updateData: Prisma.SalaryRecordUpdateInput = {
          [field]: currentValue + amount,
          adjustmentNote: validatedData.note || null,
          netSalary: buildNetSalary({
            baseSalary: record.baseSalary,
            seniorityPay: record.seniorityPay,
            otherAdjustment:
              validatedData.field === 'otherAdjustment'
                ? currentValue + amount
                : record.otherAdjustment,
            classLeaderAllowance:
              validatedData.field === 'classLeaderAllowance'
                ? currentValue + amount
                : record.classLeaderAllowance,
            dormHeadAllowance:
              validatedData.field === 'dormHeadAllowance'
                ? currentValue + amount
                : record.dormHeadAllowance,
            electricityAllowance:
              validatedData.field === 'electricityAllowance'
                ? currentValue + amount
                : record.electricityAllowance,
            supplementalPay:
              validatedData.field === 'supplementalPay'
                ? currentValue + amount
                : record.supplementalPay,
            totalOvertimePay: record.totalOvertimePay,
            deduction: record.deduction,
            deductionAdjustment:
              validatedData.field === 'deductionAdjustment'
                ? currentValue + amount
                : record.deductionAdjustment,
          }),
        }

        return prisma.salaryRecord.update({
          where: { id: record.id },
          data: updateData,
        })
      })
    )

    revalidatePath('/dashboard/salary')
    return { success: `已批量调整 ${records.length} 条薪资记录` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '批量调整失败，请稍后重试' }
  }
}

export async function updateSalaryAdjustment(formData: FormData) {
  try {
    await requireAdminUser()

    const parseNumber = (value: FormDataEntryValue | null, defaultValue = 0) => {
      if (value === null || value === '') return defaultValue
      const num = Number(value)
      return Number.isNaN(num) ? defaultValue : num
    }

    const record = await prisma.salaryRecord.findUnique({
      where: { id: formData.get('salaryId') as string },
      select: {
        id: true,
        status: true,
        baseSalary: true,
        seniorityPay: true,
        otherAdjustment: true,
        classLeaderAllowance: true,
        dormHeadAllowance: true,
        electricityAllowance: true,
        supplementalPay: true,
        deductionAdjustment: true,
        totalOvertimePay: true,
        deduction: true,
      },
    })

    if (!record) {
      return { error: '薪资记录不存在' }
    }

    if (record.status !== 'DRAFT') {
      return { error: '仅草稿状态的薪资记录可以调整' }
    }

    const otherAdjustment = parseNumber(formData.get('otherAdjustment'), record.otherAdjustment)
    const classLeaderAllowance = parseNumber(formData.get('classLeaderAllowance'), record.classLeaderAllowance)
    const dormHeadAllowance = parseNumber(formData.get('dormHeadAllowance'), record.dormHeadAllowance)
    const electricityAllowance = parseNumber(formData.get('electricityAllowance'), record.electricityAllowance)
    const supplementalPay = parseNumber(formData.get('supplementalPay'), record.supplementalPay)
    const deductionAdjustment = parseNumber(formData.get('deductionAdjustment'), record.deductionAdjustment)
    const note = formData.get('note') as string | null

    await prisma.salaryRecord.update({
      where: { id: record.id },
      data: {
        otherAdjustment,
        classLeaderAllowance,
        dormHeadAllowance,
        electricityAllowance,
        supplementalPay,
        deductionAdjustment,
        adjustmentNote: note || null,
        netSalary: buildNetSalary({
          baseSalary: record.baseSalary,
          seniorityPay: record.seniorityPay,
          otherAdjustment,
          classLeaderAllowance,
          dormHeadAllowance,
          electricityAllowance,
          supplementalPay,
          totalOvertimePay: record.totalOvertimePay,
          deduction: record.deduction,
          deductionAdjustment,
        }),
      },
    })

    revalidatePath('/dashboard/salary')
    revalidatePath(`/dashboard/salary/${record.id}`)
    return { success: '薪资调整已更新' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新薪资调整失败，请稍后重试' }
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

export async function batchConfirmSalaryRecords(recordIds: string[]) {
  try {
    await requireAdminUser()

    if (!recordIds || recordIds.length === 0) {
      return { error: '请选择要确认的记录' }
    }

    const records = await prisma.salaryRecord.findMany({
      where: {
        id: { in: recordIds },
      },
      select: {
        id: true,
        status: true,
      },
    })

    const draftIds = records.filter((r) => r.status === 'DRAFT').map((r) => r.id)
    const nonDraftCount = records.length - draftIds.length

    if (draftIds.length === 0) {
      return { error: '选中的记录均不是草稿状态，无法确认' }
    }

    await prisma.salaryRecord.updateMany({
      where: {
        id: { in: draftIds },
      },
      data: {
        status: 'CONFIRMED',
      },
    })

    revalidatePath('/dashboard/salary')
    return {
      success: `成功确认 ${draftIds.length} 条薪资记录${nonDraftCount > 0 ? `，跳过 ${nonDraftCount} 条非草稿记录` : ''}`,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '批量确认失败，请稍后重试' }
  }
}

async function deleteSingleSalaryRecord(tx: Prisma.TransactionClient, id: string) {
  const record = await tx.salaryRecord.findUnique({
    where: { id },
  })

  if (!record) {
    return { error: '薪资记录不存在' } as const
  }

  if (record.status !== 'DRAFT') {
    return { error: '只有草稿状态的薪资记录可以删除' } as const
  }

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

  return { success: true } as const
}

export async function deleteSalaryRecord(id: string) {
  try {
    await requireAdminUser()

    const result = await prisma.$transaction(async (tx) => {
      return deleteSingleSalaryRecord(tx, id)
    })

    revalidatePath('/dashboard/salary')
    return result.success === true ? { success: '薪资记录已删除' } : { error: result.error }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function batchDeleteSalaryRecords(recordIds: string[]) {
  try {
    await requireAdminUser()

    if (!recordIds || recordIds.length === 0) {
      return { error: '请选择要删除的记录' }
    }

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const id of recordIds) {
      const result = await prisma.$transaction(async (tx) => {
        return deleteSingleSalaryRecord(tx, id)
      })

      if (result.success === true) {
        successCount += 1
      } else {
        errorCount += 1
        if (!errors.includes(result.error)) {
          errors.push(result.error)
        }
      }
    }

    revalidatePath('/dashboard/salary')

    if (successCount === 0) {
      return { error: errors.join('；') || '删除失败' }
    }

    return {
      success: `成功删除 ${successCount} 条薪资记录${errorCount > 0 ? `，${errorCount} 条失败（${errors.join('；')}）` : ''}`,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '批量删除失败，请稍后重试' }
  }
}

export async function getAvailableMonths() {
  await requireAdminUser()

  const now = new Date()
  const months: string[] = []

  for (let i = 1; i <= 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    months.push(month)
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
    return buildSalaryExportRows(records)
  } catch (error) {
    console.error('导出薪资数据失败:', error)
    return []
  }
}

export async function getSalaryStats(month?: string) {
  try {
    await requireAdminUser()

    const where: Prisma.SalaryRecordWhereInput = month ? { month } : {}
    const records = await prisma.salaryRecord.findMany({
      where,
      include: {
        user: {
          select: {
            startDate: true,
            salary: true,
            position: {
              select: {
                baseSalary: true,
                hasSeniorityPay: true,
                seniorityPayPerYear: true,
                maxSeniorityPay: true,
              },
            },
          },
        },
      },
    })

    const normalizedRecords = records.map((record) => normalizeSalaryRecord(record))

    const stats = normalizedRecords.reduce(
      (summary, record) => ({
        totalRecords: summary.totalRecords + 1,
        totalBaseSalary: summary.totalBaseSalary + record.baseSalary,
        totalSeniorityPay: summary.totalSeniorityPay + (record.seniorityPay ?? 0),
        totalOtherAdjustment: summary.totalOtherAdjustment + (record.otherAdjustment ?? 0),
        totalOvertimePay: summary.totalOvertimePay + record.totalOvertimePay,
        totalDeduction: summary.totalDeduction + record.deduction,
        totalNetSalary: summary.totalNetSalary + record.netSalary,
        totalCompensatoryHours: summary.totalCompensatoryHours + record.compensatoryHours,
      }),
      {
        totalRecords: 0,
        totalBaseSalary: 0,
        totalSeniorityPay: 0,
        totalOtherAdjustment: 0,
        totalOvertimePay: 0,
        totalDeduction: 0,
        totalNetSalary: 0,
        totalCompensatoryHours: 0,
      }
    )

    const statusCounts = await prisma.salaryRecord.groupBy({
      by: ['status'],
      where,
      _count: true,
    })

    return {
      totalRecords: stats.totalRecords,
      totalBaseSalary: stats.totalBaseSalary,
      totalSeniorityPay: stats.totalSeniorityPay,
      totalOtherAdjustment: stats.totalOtherAdjustment,
      totalOvertimePay: stats.totalOvertimePay,
      totalDeduction: stats.totalDeduction,
      totalNetSalary: stats.totalNetSalary,
      totalCompensatoryHours: stats.totalCompensatoryHours,
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
