'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { isAttendanceClerk, isEmployeeRole, requireAdminOrAttendanceClerk, requireSessionUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { calculateHours } from '@/lib/utils'
import { overtimeSchema } from '@/lib/validations'
import type { ParsedOvertimeRow } from '@/lib/excel-parser'
import { getHolidayByDate } from './holiday'

async function requireOvertimeOwnerOrAdmin(id: string) {
  const sessionUser = await requireSessionUser()
  const application = await prisma.overtimeApplication.findUnique({
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
    throw new Error('无权操作该加班申请')
  }

  return {
    sessionUser,
    application,
  }
}

export async function getOvertimeTypeByDate(date: Date): Promise<'WORKDAY' | 'WEEKEND' | 'HOLIDAY'> {
  const holiday = await getHolidayByDate(date)

  if (holiday) {
    if (holiday.rat === 3) {
      return 'HOLIDAY'
    }
    if (holiday.rat === 2) {
      return 'WEEKEND'
    }
    return 'WORKDAY'
  }

  // 无 Holiday 记录时，按星期判断
  const day = date.getDay()
  return day === 0 || day === 6 ? 'WEEKEND' : 'WORKDAY'
}

export async function createOvertimeApplication(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const validatedData = overtimeSchema.parse({
      startDate: formData.get('startDate'),
      startTime: formData.get('startTime'),
      endDate: formData.get('endDate'),
      endTime: formData.get('endTime'),
      type: formData.get('type'),
      reason: formData.get('reason'),
    })

    const startDateTime = new Date(`${validatedData.startDate} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.endDate} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    // 根据加班日期自动判断类型（rat 关联薪资系数）
    const autoType = await getOvertimeTypeByDate(startDateTime)

    const action = formData.get('action') === 'submit' ? 'submit' : 'save'
    const created = await prisma.overtimeApplication.create({
      data: {
        userId: sessionUser.id,
        date: startDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
        hours,
        type: autoType,
        reason: validatedData.reason,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/overtime')

    return {
      success: action === 'submit' ? '加班申请已提交' : '加班草稿已保存',
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

export async function deleteOvertimeApplication(id: string) {
  try {
    if (!id) {
      return { error: '缺少加班申请 ID' }
    }

    const sessionUser = await requireSessionUser()
    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        approverId: true,
      },
    })

    if (!application) {
      return { error: '加班申请不存在' }
    }

    const isOwner = sessionUser.id === application.userId
    const isAdmin = sessionUser.role === 'ADMIN'
    const isClerkDeletingImport =
      isAttendanceClerk(sessionUser.role) &&
      application.status === 'COMPLETED' &&
      application.approverId === null

    if (!isOwner && !isAdmin && !isClerkDeletingImport) {
      return { error: '无权操作该加班申请' }
    }

    if (application.status !== 'DRAFT' && !isAdmin && !isClerkDeletingImport) {
      return { error: '只有草稿状态的加班申请可以删除' }
    }

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'OVERTIME',
        },
      }),
      prisma.overtimeApplication.delete({
        where: { id },
      }),
    ])

    revalidatePath('/dashboard/overtime')
    return { success: '加班申请已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function updateOvertimeApplication(formData: FormData) {
  try {
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
      return { error: '缺少加班申请 ID' }
    }

    const validatedData = overtimeSchema.parse({
      startDate: formData.get('startDate'),
      startTime: formData.get('startTime'),
      endDate: formData.get('endDate'),
      endTime: formData.get('endTime'),
      type: formData.get('type'),
      reason: formData.get('reason'),
    })

    const { application } = await requireOvertimeOwnerOrAdmin(id)

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的加班申请可以修改' }
    }

    const startDateTime = new Date(`${validatedData.startDate} ${validatedData.startTime}`)
    const endDateTime = new Date(`${validatedData.endDate} ${validatedData.endTime}`)
    const hours = calculateHours(startDateTime, endDateTime)

    if (hours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    const nextStatus = formData.get('action') === 'submit' ? 'PENDING' : 'DRAFT'

    // 根据加班日期自动判断类型（rat 关联薪资系数）
    const autoType = await getOvertimeTypeByDate(startDateTime)

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'OVERTIME',
        },
      }),
      prisma.overtimeApplication.update({
        where: { id },
        data: {
          date: startDateTime,
          startTime: startDateTime,
          endTime: endDateTime,
          hours,
          type: autoType,
          reason: validatedData.reason,
          status: nextStatus,
          approverId: null,
          approvedAt: null,
          remark: null,
        },
      }),
    ])

    revalidatePath('/dashboard/overtime')
    return {
      success:
        nextStatus === 'PENDING' ? '加班申请已提交，审批流程已重新开始' : '加班申请已保存为草稿',
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function getOvertimeApplications(_userId?: string, _role?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const where: Prisma.OvertimeApplicationWhereInput = {
      userId: sessionUser.id,
    }

    const applications = await prisma.overtimeApplication.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return applications.map((application) => ({
      ...application,
      userName: application.user.name,
    }))
  } catch (error) {
    console.error('获取加班申请列表失败:', error)
    return []
  }
}

export async function getOvertimeApplication(id: string) {
  try {
    const sessionUser = await requireSessionUser()
    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    })

    if (!application) {
      return null
    }

    if (sessionUser.role === 'EMPLOYEE' && application.userId !== sessionUser.id) {
      return null
    }

    return {
      ...application,
      userName: application.user.name,
    }
  } catch (error) {
    console.error('获取加班申请详情失败:', error)
    return null
  }
}

export async function getOvertimeStats(userId?: string, departmentId?: string, referenceMonth?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const now = new Date()
    const [year, month] = referenceMonth
      ? referenceMonth.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1]
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59)

    const where: Prisma.OvertimeApplicationWhereInput = {
      status: {
        in: ['COMPLETED'],
      },
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
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

    const result = await prisma.overtimeApplication.aggregate({
      where,
      _sum: {
        actualHours: true,
      },
    })

    return result._sum.actualHours || 0
  } catch (error) {
    console.error('获取加班统计失败:', error)
    return 0
  }
}

// 提交加班确认（申请人填写实际加班时间后提交）
export async function submitOvertimeConfirmation(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const id = formData.get('id') as string

    if (!id) {
      return { error: '缺少加班申请 ID' }
    }

    const application = await prisma.overtimeApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    })

    if (!application) {
      return { error: '加班申请不存在' }
    }

    if (application.userId !== sessionUser.id) {
      return { error: '无权操作该加班申请' }
    }

    if (application.status !== 'PRE_APPROVED') {
      return { error: '只有事前审批通过的加班申请可以提交确认' }
    }

    const startDate = formData.get('startDate') as string
    const startTime = formData.get('startTime') as string
    const endDate = formData.get('endDate') as string
    const endTime = formData.get('endTime') as string

    if (!startDate || !startTime || !endDate || !endTime) {
      return { error: '请填写完整的实际加班时间' }
    }

    const actualStartTime = new Date(`${startDate} ${startTime}`)
    const actualEndTime = new Date(`${endDate} ${endTime}`)
    const actualHours = calculateHours(actualStartTime, actualEndTime)

    if (actualHours <= 0) {
      return { error: '结束时间必须晚于开始时间' }
    }

    await prisma.$transaction([
      // 清除之前 CONFIRM 阶段的审批记录（如被退回后重新提交）
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: 'OVERTIME',
          phase: 'CONFIRM',
        },
      }),
      prisma.overtimeApplication.update({
        where: { id },
        data: {
          actualStartTime,
          actualEndTime,
          actualHours,
          status: 'CONFIRM_PENDING',
          currentPhase: 'CONFIRM',
        },
      }),
    ])

    revalidatePath('/dashboard/overtime')
    return { success: '加班确认已提交，进入确认审批流程' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交确认失败，请稍后重试' }
  }
}


// ===== 批量导入加班 =====

export async function batchImportOvertime(rows: ParsedOvertimeRow[]) {
  try {
    await requireAdminOrAttendanceClerk()

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
        const startDateTime = new Date(`${row.date} ${row.startTime}`)
        const endDateTime = new Date(`${row.date} ${row.endTime}`)
        const hours = calculateHours(startDateTime, endDateTime)

        if (hours <= 0) {
          throw new Error(`第 ${row.rowIndex} 行：结束时间必须晚于开始时间`)
        }

        // 根据加班日期自动判断类型（rat 关联薪资系数）
        const autoType = await getOvertimeTypeByDate(startDateTime)

        await tx.overtimeApplication.create({
          data: {
            userId: user.id,
            date: startDateTime,
            startTime: startDateTime,
            endTime: endDateTime,
            hours,
            actualStartTime: startDateTime,
            actualEndTime: endDateTime,
            actualHours: hours,
            type: autoType,
            reason: row.reason,
            status: 'COMPLETED',
            currentPhase: 'CONFIRM',
            approverId: null,
            approvedAt: now,
          },
        })
      }
    })

    revalidatePath('/dashboard/overtime')
    return { success: `成功导入 ${rows.length} 条加班记录` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '导入失败，请稍后重试' }
  }
}
