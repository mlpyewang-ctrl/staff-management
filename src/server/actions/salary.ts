'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { salaryGenerateSchema, salaryStatusSchema } from '@/lib/validations'
import {
  calculateHourlyRate,
  calculateOvertimeAllocation,
  getPreviousMonth,
  canGenerateSalary,
} from '@/lib/utils'
import { SALARY_CONSTANTS } from '@/types'

// 获取薪资记录列表
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
    console.error('获取薪资记录失败:', error)
    return []
  }
}

// 获取单条薪资记录
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

    return {
      ...record,
      userName: record.user.name,
      departmentName: record.user.department?.name,
      positionName: record.user.position?.name,
    }
  } catch (error) {
    console.error('获取薪资记录详情失败:', error)
    return null
  }
}

// 生成薪资记录
export async function generateSalaryRecords(formData: FormData) {
  try {
    const validatedData = salaryGenerateSchema.parse({
      month: formData.get('month'),
      departmentId: formData.get('departmentId') || undefined,
    })

    const { month, departmentId } = validatedData

    // 检查是否可以生成
    const checkResult = canGenerateSalary(month)
    if (!checkResult.canGenerate) {
      return { error: checkResult.message }
    }

    // 获取需要生成薪资的用户
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

    // 解析月份
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59)

    let successCount = 0
    let skipCount = 0

    for (const user of users) {
      // 检查是否已存在该月份的薪资记录
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

      // 获取基本工资
      const baseSalary = user.salary || user.position?.salary || 0
      if (!baseSalary) {
        console.log(`用户 ${user.name} 没有设置薪资，跳过`)
        skipCount++
        continue
      }

      // 获取当月已审批的加班记录
      const overtimeApps = await prisma.overtimeApplication.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      })

      // 按类型分组统计加班时长
      const overtimeByType = {
        WORKDAY: 0,
        WEEKEND: 0,
        HOLIDAY: 0,
      }

      for (const ot of overtimeApps) {
        overtimeByType[ot.type as keyof typeof overtimeByType] += ot.hours
      }

      // 计算时薪
      const hourlyRate = calculateHourlyRate(baseSalary)

      // 计算加班分配
      const overtimeData = [
        { type: 'HOLIDAY' as const, hours: overtimeByType.HOLIDAY },
        { type: 'WEEKEND' as const, hours: overtimeByType.WEEKEND },
        { type: 'WORKDAY' as const, hours: overtimeByType.WORKDAY },
      ].filter((item) => item.hours > 0)

      const allocation = calculateOvertimeAllocation(overtimeData, hourlyRate)

      // 计算请假扣款（事假）
      const leaveApps = await prisma.leaveApplication.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
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

      // 计算应发工资
      const netSalary = baseSalary + allocation.totalPay - deduction

      // 创建薪资记录
      const salaryRecord = await prisma.salaryRecord.create({
        data: {
          userId: user.id,
          month,
          baseSalary,
          // 这里的 *OvertimeHours 表示“计薪小时数”（超过36小时的部分转调休，不计薪）
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

      // 创建加班清算记录并更新调休余额
      if (allocation.compensatoryHours > 0) {
        // 找出转调休的加班记录
        let remainingCompensatoryHours = allocation.compensatoryHours

        // 按优先级找出需要转调休的加班记录（工作日优先转调休）
        const sortedOvertime = [...overtimeApps].sort((a, b) => {
          const priority = { WORKDAY: 0, WEEKEND: 1, HOLIDAY: 2 }
          return priority[a.type as keyof typeof priority] - priority[b.type as keyof typeof priority]
        })

        for (const ot of sortedOvertime) {
          if (remainingCompensatoryHours <= 0) break

          const hoursToSettle = Math.min(ot.hours, remainingCompensatoryHours)

          // 如果同一条加班既计薪又转调休，允许存在多条 settlement（按 settlementType 区分）
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

        // 更新调休余额
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

      // 为计薪的加班创建清算记录
      for (const paid of allocation.paidHours) {
        const otRecords = overtimeApps.filter((ot) => ot.type === paid.type)
        let remainingHours = paid.hours

        for (const ot of otRecords) {
          if (remainingHours <= 0) break

          // 检查是否已经创建了清算记录
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
      success: `成功生成 ${successCount} 条薪资记录${skipCount > 0 ? `，跳过 ${skipCount} 条（已存在或无薪资）` : ''}`,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '生成失败，请稍后重试' }
  }
}

// 更新薪资状态
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
    return { error: '更新失败，请稍后重试' }
  }
}

// 删除薪资记录（仅草稿状态可删除）
export async function deleteSalaryRecord(id: string) {
  try {
    const record = await prisma.salaryRecord.findUnique({
      where: { id },
    })

    if (!record) {
      return { error: '薪资记录不存在' }
    }

    if (record.status !== 'DRAFT') {
      return { error: '只有草稿状态的薪资记录可以删除' }
    }

    // 删除关联的清算记录
    await prisma.overtimeSettlement.deleteMany({
      where: { salaryRecordId: id },
    })

    // 删除薪资记录
    await prisma.salaryRecord.delete({
      where: { id },
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

// 获取可生成的月份
export async function getAvailableMonths() {
  const now = new Date()
  const months: string[] = []

  // 获取过去6个月的月份
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    
    // 检查是否可以生成
    const check = canGenerateSalary(monthStr)
    if (check.canGenerate) {
      months.push(monthStr)
    }
  }

  return months
}

// 导出薪资数据为 Excel 格式（返回数据供前端处理）
export async function getSalaryExportData(filters?: {
  month?: string
  departmentId?: string
  status?: string
}) {
  try {
    const records = await getSalaryRecords(filters)

    return records.map((record) => ({
      '员工编号': record.userId,
      '姓名': record.userName,
      '部门': record.departmentName || '',
      '岗位': record.positionName || '',
      '职级': record.user.level || '',
      '薪资月份': record.month,
      '基本工资': record.baseSalary,
      '工作日加班(小时)': record.workdayOvertimeHours,
      '工作日加班费': record.workdayOvertimePay,
      '周末加班(小时)': record.weekendOvertimeHours,
      '周末加班费': record.weekendOvertimePay,
      '节假日加班(小时)': record.holidayOvertimeHours,
      '节假日加班费': record.holidayOvertimePay,
      '加班费合计': record.totalOvertimePay,
      '转调休(小时)': record.compensatoryHours,
      '请假扣款': record.deduction,
      '应发工资': record.netSalary,
      '状态': record.status === 'DRAFT' ? '草稿' : record.status === 'CONFIRMED' ? '已确认' : '已支付',
    }))
  } catch (error) {
    console.error('导出薪资数据失败:', error)
    return []
  }
}

// 获取薪资统计
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
    console.error('获取薪资统计失败:', error)
    return null
  }
}
