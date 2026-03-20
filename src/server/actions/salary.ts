'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { salaryGenerateSchema, salaryStatusSchema } from '@/lib/validations'
import {
  calculateHourlyRate,
  calculateOvertimeAllocation,
  canGenerateSalary,
} from '@/lib/utils'
import { SALARY_CONSTANTS } from '@/types'

function buildSalaryRecordSummary<T extends {
  baseSalary: number
  workdayOvertimeHours: number
  weekendOvertimeHours: number
  holidayOvertimeHours: number
  compensatoryHours: number
}>(
  record: T,
  compensatoryHoursOverride?: number
) {
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

// 鑾峰彇钖祫璁板綍鍒楄〃
export async function getSalaryRecords(filters?: {
  month?: string
  departmentId?: string
  status?: string
  userId?: string
}) {
  try {
    const where: any = {}

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

    const records = await prisma.salaryRecord.findMany({
      where,
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
    console.error('鑾峰彇钖祫璁板綍澶辫触:', error)
    return []
  }
}

// 鑾峰彇鍗曟潯钖祫璁板綍
export async function getSalaryRecord(id: string) {
  try {
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

    if (!record) return null

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
    console.error('鑾峰彇钖祫璁板綍璇︽儏澶辫触:', error)
    return null
  }
}

// 鐢熸垚钖祫璁板綍
export async function generateSalaryRecords(formData: FormData) {
  try {
    const validatedData = salaryGenerateSchema.parse({
      month: formData.get('month'),
      departmentId: formData.get('departmentId') || undefined,
    })

    const { month, departmentId } = validatedData

    // 妫€鏌ユ槸鍚﹀彲浠ョ敓鎴?
    const checkResult = canGenerateSalary(month)
    if (!checkResult.canGenerate) {
      return { error: checkResult.message }
    }

    // 鑾峰彇闇€瑕佺敓鎴愯柂璧勭殑鐢ㄦ埛
    const userWhere: any = {}
    if (departmentId) {
      userWhere.departmentId = departmentId
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        position: true,
        department: true,
        leaveBalance: true,
      },
    })

    if (users.length === 0) {
      return { error: '没有找到符合条件的员工' }
    }

    // 瑙ｆ瀽鏈堜唤
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59)

    let successCount = 0
    let skipCount = 0

    for (const user of users) {
      // 妫€鏌ユ槸鍚﹀凡瀛樺湪璇ユ湀浠界殑钖祫璁板綍
      const existing = await prisma.salaryRecord.findUnique({
        where: {
          userId_month: {
            userId: user.id,
            month,
          },
        },
      })

      if (existing) {
        skipCount++
        continue
      }

      // 鑾峰彇鍩烘湰宸ヨ祫
      const baseSalary = user.position?.salary ?? user.salary ?? 0
      if (!baseSalary) {
        console.log(`用户 ${user.name} 未设置薪资，已跳过`)
        skipCount++
        continue
      }

      // 鑾峰彇褰撴湀宸插鎵圭殑鍔犵彮璁板綍
      const overtimeApps = await prisma.overtimeApplication.findMany({
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

      // 鎸夌被鍨嬪垎缁勭粺璁″姞鐝椂闀?
      const overtimeByType = {
        WORKDAY: 0,
        WEEKEND: 0,
        HOLIDAY: 0,
      }

      for (const ot of overtimeApps) {
        overtimeByType[ot.type as keyof typeof overtimeByType] += ot.hours
      }

      // 璁＄畻鏃惰柂
      const hourlyRate = calculateHourlyRate(baseSalary)

      // 璁＄畻鍔犵彮鍒嗛厤
      const overtimeData = [
        { type: 'HOLIDAY' as const, hours: overtimeByType.HOLIDAY },
        { type: 'WEEKEND' as const, hours: overtimeByType.WEEKEND },
        { type: 'WORKDAY' as const, hours: overtimeByType.WORKDAY },
      ].filter((item) => item.hours > 0)

      const allocation = calculateOvertimeAllocation(overtimeData, hourlyRate)

      // 璁＄畻璇峰亣鎵ｆ锛堜簨鍋囷級
      const leaveApps = await prisma.leaveApplication.findMany({
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
      const personalLeaveDays = leaveApps.reduce((sum, app) => sum + app.days, 0)
      const deduction = Math.round(personalLeaveDays * dailyRate * 100) / 100

      // 璁＄畻搴斿彂宸ヨ祫
      const netSalary = baseSalary + allocation.totalPay - deduction

      // 鍒涘缓钖祫璁板綍
      const salaryRecord = await prisma.salaryRecord.create({
        data: {
          userId: user.id,
          month,
          baseSalary,
          // 杩欓噷鐨?*OvertimeHours 琛ㄧず鈥滆钖皬鏃舵暟鈥濓紙瓒呰繃36灏忔椂鐨勯儴鍒嗚浆璋冧紤锛屼笉璁¤柂锛?
          workdayOvertimeHours: allocation.paidHours
            .filter((h) => h.type === 'WORKDAY')
            .reduce((sum, h) => sum + h.hours, 0),
          workdayOvertimePay: allocation.paidHours
            .filter((h) => h.type === 'WORKDAY')
            .reduce((sum, h) => sum + h.hours * hourlyRate * SALARY_CONSTANTS.WORKDAY_OVERTIME_RATE, 0),
          weekendOvertimeHours: allocation.paidHours
            .filter((h) => h.type === 'WEEKEND')
            .reduce((sum, h) => sum + h.hours, 0),
          weekendOvertimePay: allocation.paidHours
            .filter((h) => h.type === 'WEEKEND')
            .reduce((sum, h) => sum + h.hours * hourlyRate * SALARY_CONSTANTS.WEEKEND_OVERTIME_RATE, 0),
          holidayOvertimeHours: allocation.paidHours
            .filter((h) => h.type === 'HOLIDAY')
            .reduce((sum, h) => sum + h.hours, 0),
          holidayOvertimePay: allocation.paidHours
            .filter((h) => h.type === 'HOLIDAY')
            .reduce((sum, h) => sum + h.hours * hourlyRate * SALARY_CONSTANTS.HOLIDAY_OVERTIME_RATE, 0),
          totalOvertimePay: allocation.totalPay,
          compensatoryHours: allocation.compensatoryHours,
          deduction,
          netSalary,
          status: 'DRAFT',
        },
      })

      // 鍒涘缓鍔犵彮娓呯畻璁板綍骞舵洿鏂拌皟浼戜綑棰?
      if (allocation.compensatoryHours > 0) {
        // 鎵惧嚭杞皟浼戠殑鍔犵彮璁板綍
        let remainingCompensatoryHours = allocation.compensatoryHours

        // 鎸変紭鍏堢骇鎵惧嚭闇€瑕佽浆璋冧紤鐨勫姞鐝褰曪紙宸ヤ綔鏃ヤ紭鍏堣浆璋冧紤锛?
        const sortedOvertime = [...overtimeApps].sort((a, b) => {
          const priority = { WORKDAY: 0, WEEKEND: 1, HOLIDAY: 2 }
          return priority[a.type as keyof typeof priority] - priority[b.type as keyof typeof priority]
        })

        for (const ot of sortedOvertime) {
          if (remainingCompensatoryHours <= 0) break

          const hoursToSettle = Math.min(ot.hours, remainingCompensatoryHours)

          // 濡傛灉鍚屼竴鏉″姞鐝棦璁¤柂鍙堣浆璋冧紤锛屽厑璁稿瓨鍦ㄥ鏉?settlement锛堟寜 settlementType 鍖哄垎锛?
          const existingCompSettlement = await prisma.overtimeSettlement.findFirst({
            where: {
              overtimeId: ot.id,
              settlementType: 'COMPENSATORY',
            },
          })

          if (existingCompSettlement) {
            remainingCompensatoryHours -= hoursToSettle
            continue
          }

          await prisma.overtimeSettlement.create({
            data: {
              userId: user.id,
              overtimeId: ot.id,
              salaryRecordId: salaryRecord.id,
              hours: hoursToSettle,
              settlementType: 'COMPENSATORY',
            },
          })

          remainingCompensatoryHours -= hoursToSettle
        }

        // 鏇存柊璋冧紤浣欓
        if (user.leaveBalance) {
          await prisma.leaveBalance.update({
            where: { userId: user.id },
            data: {
              compensatory: {
                increment: allocation.compensatoryHours,
              },
            },
          })
        }
      }

      // 涓鸿钖殑鍔犵彮鍒涘缓娓呯畻璁板綍
      for (const paid of allocation.paidHours) {
        const otRecords = overtimeApps.filter((ot) => ot.type === paid.type)
        let remainingHours = paid.hours

        for (const ot of otRecords) {
          if (remainingHours <= 0) break

          // 妫€鏌ユ槸鍚﹀凡缁忓垱寤轰簡娓呯畻璁板綍
          const existingSettlement = await prisma.overtimeSettlement.findFirst({
            where: {
              overtimeId: ot.id,
              settlementType: 'SALARY',
            },
          })

          if (existingSettlement) continue

          const hoursToSettle = Math.min(ot.hours, remainingHours)

          await prisma.overtimeSettlement.create({
            data: {
              userId: user.id,
              overtimeId: ot.id,
              salaryRecordId: salaryRecord.id,
              hours: hoursToSettle,
              settlementType: 'SALARY',
            },
          })

          remainingHours -= hoursToSettle
        }
      }

      successCount++
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
    return { error: '鐢熸垚澶辫触锛岃绋嶅悗閲嶈瘯' }
  }
}

// 鏇存柊钖祫鐘舵€?
export async function updateSalaryStatus(formData: FormData) {
  try {
    const validatedData = salaryStatusSchema.parse({
      salaryId: formData.get('salaryId'),
      status: formData.get('status'),
    })

    const updateData: any = {
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
    return { error: '鏇存柊澶辫触锛岃绋嶅悗閲嶈瘯' }
  }
}

// 鍒犻櫎钖祫璁板綍锛堜粎鑽夌鐘舵€佸彲鍒犻櫎锛?
export async function deleteSalaryRecord(id: string) {
  try {
    const record = await prisma.salaryRecord.findUnique({
      where: { id },
    })

    if (!record) {
      return { error: '薪资记录不存在' }
    }

    if (record.status !== 'DRAFT') {
      return { error: '鍙湁鑽夌鐘舵€佺殑钖祫璁板綍鍙互鍒犻櫎' }
    }

    // 鍒犻櫎鍏宠仈鐨勬竻绠楄褰?
    await prisma.overtimeSettlement.deleteMany({
      where: { salaryRecordId: id },
    })

    // 鍒犻櫎钖祫璁板綍
    await prisma.salaryRecord.delete({
      where: { id },
    })

    revalidatePath('/dashboard/salary')
    return { success: '薪资记录已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '鍒犻櫎澶辫触锛岃绋嶅悗閲嶈瘯' }
  }
}

// 鑾峰彇鍙敓鎴愮殑鏈堜唤
export async function getAvailableMonths() {
  const now = new Date()
  const months: string[] = []

  // 鑾峰彇杩囧幓6涓湀鐨勬湀浠?
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    
    // 妫€鏌ユ槸鍚﹀彲浠ョ敓鎴?
    const check = canGenerateSalary(monthStr)
    if (check.canGenerate) {
      months.push(monthStr)
    }
  }

  return months
}

export async function getSalaryMonths() {
  try {
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
    console.error('鑾峰彇钖祫鏈堜唤鍒楄〃澶辫触:', error)
    return []
  }
}

// 瀵煎嚭钖祫鏁版嵁涓?Excel 鏍煎紡锛堣繑鍥炴暟鎹緵鍓嶇澶勭悊锛?
export async function getSalaryExportData(filters?: {
  month?: string
  departmentId?: string
  status?: string
}) {
  try {
    if (!filters?.month) {
      return []
    }

    const records = await getSalaryRecords(filters)

    return records.map((record) => ({
      '员工编号': record.userId,
      姓名: record.userName,
      部门: record.departmentName || '',
      岗位: record.positionName || '',
      职级: record.user.level || '',
      月份: record.month,
      薪资: record.netSalary,
      工作日加班工资: record.workdayOvertimePay,
      工作日加班时长: record.workdayOvertimeHours,
      周末日加班工资: record.weekendOvertimePay,
      周末日加班时长: record.weekendOvertimeHours,
      法定节假日加班工资: record.holidayOvertimePay,
      加班时长:
        record.workdayOvertimeHours + record.weekendOvertimeHours + record.holidayOvertimeHours,
      调休时长: record.compensatoryHours,
    }))
  } catch (error) {
    console.error('瀵煎嚭钖祫鏁版嵁澶辫触:', error)
    return []
  }
}

// 鑾峰彇钖祫缁熻
export async function getSalaryStats(month?: string) {
  try {
    const where = month ? { month } : {}

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
      statusBreakdown: statusCounts.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    }
  } catch (error) {
    console.error('鑾峰彇钖祫缁熻澶辫触:', error)
    return null
  }
}

