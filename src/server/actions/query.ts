'use server'

import type { Prisma } from '@prisma/client'
import { requireManagerUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import type { TimeRange } from '@/lib/time-range'

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPENSATORY: '调休',
}

const overtimeStatusMap: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '事前审批中',
  PRE_APPROVED: '事前通过待确认',
  CONFIRM_PENDING: '确认审批中',
  COMPLETED: '已完成',
  REJECTED: '已退回',
}

const leaveStatusMap: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审批中',
  APPROVED: '已通过',
  COMPLETED: '已完成',
  REJECTED: '已退回',
}

function buildTimeRangeWhere(range: TimeRange): { gte?: Date; lte?: Date } | undefined {
  if (range === 'all') {
    return undefined
  }

  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setMonth(start.getMonth() - (range === 'last1Month' ? 1 : 3))

  return {
    gte: start,
    lte: now,
  }
}

export interface QueryFilters {
  departmentId?: string
  userName?: string
  timeRange?: TimeRange
  status?: string
  type?: string
}

interface OvertimeQueryItem {
  id: string
  userId: string
  userName: string
  departmentName?: string | null
  date: Date
  startTime: Date
  endTime: Date
  hours: number
  actualStartTime: Date | null
  actualEndTime: Date | null
  actualHours: number | null
  type: string
  reason: string
  status: string
  statusText: string
  remark: string | null
  createdAt: Date
}

interface LeaveQueryItem {
  id: string
  userId: string
  userName: string
  departmentName?: string | null
  type: string
  leaveTypeText: string
  startDate: Date
  endDate: Date
  days: number
  startSession: string | null
  endSession: string | null
  reason: string
  destination: string | null
  status: string
  statusText: string
  remark: string | null
  createdAt: Date
}

function buildOvertimeWhere(filters: QueryFilters): Prisma.OvertimeApplicationWhereInput {
  const where: Prisma.OvertimeApplicationWhereInput = {}

  if (filters.departmentId) {
    where.user = { ...(where.user as object), departmentId: filters.departmentId }
  }

  if (filters.userName) {
    where.user = {
      ...(where.user as object),
      name: { contains: filters.userName, mode: 'insensitive' },
    }
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.type) {
    where.type = filters.type
  }

  const dateRange = buildTimeRangeWhere(filters.timeRange || 'all')
  if (dateRange) {
    where.date = dateRange
  }

  return where
}

function buildLeaveWhere(filters: QueryFilters): Prisma.LeaveApplicationWhereInput {
  const where: Prisma.LeaveApplicationWhereInput = {}

  if (filters.departmentId) {
    where.user = { ...(where.user as object), departmentId: filters.departmentId }
  }

  if (filters.userName) {
    where.user = {
      ...(where.user as object),
      name: { contains: filters.userName, mode: 'insensitive' },
    }
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.type) {
    where.type = filters.type
  }

  const dateRange = buildTimeRangeWhere(filters.timeRange || 'all')
  if (dateRange) {
    where.startDate = { gte: dateRange.gte }
    where.endDate = { lte: dateRange.lte }
  }

  return where
}

export async function getQueryOvertimeList(
  filters: QueryFilters,
  page: number,
  pageSize: number
) {
  try {
    await requireManagerUser()

    const where = buildOvertimeWhere(filters)
    const skip = (page - 1) * pageSize

    const [items, total] = await Promise.all([
      prisma.overtimeApplication.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              department: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.overtimeApplication.count({ where }),
    ])

    const mappedItems: OvertimeQueryItem[] = items.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: item.user.name,
      departmentName: item.user.department?.name,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      hours: item.hours,
      actualStartTime: item.actualStartTime,
      actualEndTime: item.actualEndTime,
      actualHours: item.actualHours,
      type: item.type,
      reason: item.reason,
      status: item.status,
      statusText: overtimeStatusMap[item.status] || item.status,
      remark: item.remark,
      createdAt: item.createdAt,
    }))

    return { items: mappedItems, total }
  } catch (error) {
    console.error('查询加班列表失败:', error)
    return { items: [], total: 0 }
  }
}

export async function getQueryLeaveList(
  filters: QueryFilters,
  page: number,
  pageSize: number
) {
  try {
    await requireManagerUser()

    const where = buildLeaveWhere(filters)
    const skip = (page - 1) * pageSize

    const [items, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              department: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.leaveApplication.count({ where }),
    ])

    const mappedItems: LeaveQueryItem[] = items.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: item.user.name,
      departmentName: item.user.department?.name,
      type: item.type,
      leaveTypeText: leaveTypeMap[item.type] || item.type,
      startDate: item.startDate,
      endDate: item.endDate,
      days: item.days,
      startSession: item.startSession || item.halfDaySession || null,
      endSession: item.endSession || item.halfDaySession || null,
      reason: item.reason,
      destination: item.destination,
      status: item.status,
      statusText: leaveStatusMap[item.status] || item.status,
      remark: item.remark,
      createdAt: item.createdAt,
    }))

    return { items: mappedItems, total }
  } catch (error) {
    console.error('查询请假列表失败:', error)
    return { items: [], total: 0 }
  }
}

export async function exportOvertimeQuery(filters: QueryFilters) {
  try {
    await requireManagerUser()

    const where = buildOvertimeWhere(filters)

    const items = await prisma.overtimeApplication.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            department: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return items.map((item) => ({
      id: item.id,
      userName: item.user.name,
      departmentName: item.user.department?.name,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      hours: item.hours,
      actualStartTime: item.actualStartTime,
      actualEndTime: item.actualEndTime,
      actualHours: item.actualHours,
      type: item.type === 'WEEKEND' ? '周末' : item.type === 'HOLIDAY' ? '节假日' : '工作日',
      reason: item.reason,
      status: overtimeStatusMap[item.status] || item.status,
      remark: item.remark,
      createdAt: item.createdAt,
    }))
  } catch (error) {
    console.error('导出加班数据失败:', error)
    return []
  }
}

export async function exportLeaveQuery(filters: QueryFilters) {
  try {
    await requireManagerUser()

    const where = buildLeaveWhere(filters)

    const items = await prisma.leaveApplication.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            department: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return items.map((item) => ({
      id: item.id,
      userName: item.user.name,
      departmentName: item.user.department?.name,
      type: leaveTypeMap[item.type] || item.type,
      startDate: item.startDate,
      endDate: item.endDate,
      days: item.days,
      startSession: item.startSession || item.halfDaySession || '',
      endSession: item.endSession || item.halfDaySession || '',
      reason: item.reason,
      destination: item.destination,
      status: leaveStatusMap[item.status] || item.status,
      remark: item.remark,
      createdAt: item.createdAt,
    }))
  } catch (error) {
    console.error('导出请假数据失败:', error)
    return []
  }
}
