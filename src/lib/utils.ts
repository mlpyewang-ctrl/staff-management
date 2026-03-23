import { type ClassValue, clsx } from 'clsx'
import { SALARY_CONSTANTS, type LeaveSession } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function calculateHours(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10
}

export function calculateDays(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getLeaveSessionLabel(session?: LeaveSession | string | null): string {
  if (session === 'AM') {
    return '上午'
  }

  if (session === 'PM') {
    return '下午'
  }

  return '-'
}

export function calculateLeaveDaysExcludingNonWorkingDays(
  start: Date,
  end: Date,
  options?: {
    legalHolidayDates?: string[]
    compensatoryWorkDates?: string[]
    startSession?: LeaveSession
    endSession?: LeaveSession
  }
): number {
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  if (endDate < startDate) {
    return 0
  }

  const legalHolidayDates = new Set(options?.legalHolidayDates || [])
  const compensatoryWorkDates = new Set(options?.compensatoryWorkDates || [])
  const startSession = options?.startSession || 'AM'
  const endSession = options?.endSession || 'PM'
  const startDateKey = formatDateKey(startDate)
  const endDateKey = formatDateKey(endDate)

  const isWorkingDay = (date: Date) => {
    const key = formatDateKey(date)
    const day = date.getDay()
    const isWeekend = day === 0 || day === 6
    const isLegalHoliday = legalHolidayDates.has(key)
    const isCompensatoryWorkday = compensatoryWorkDates.has(key)

    return isCompensatoryWorkday || (!isWeekend && !isLegalHoliday)
  }

  if (startDateKey === endDateKey) {
    if (!isWorkingDay(startDate)) {
      return 0
    }

    if (startSession === 'PM' && endSession === 'AM') {
      return 0
    }

    return startSession === endSession ? 0.5 : 1
  }

  let workingDays = 0
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (!isWorkingDay(cursor)) {
      continue
    }

    const key = formatDateKey(cursor)

    if (key === startDateKey) {
      workingDays += startSession === 'PM' ? 0.5 : 1
      continue
    }

    if (key === endDateKey) {
      workingDays += endSession === 'AM' ? 0.5 : 1
      continue
    }

    workingDays += 1
  }

  if (workingDays === 0) {
    return 0
  }

  return Math.round(workingDays * 2) / 2
}

// ========== 新增：薪资计算相关工具函数 ==========

/**
 * 计算时薪
 * @param baseSalary 月基本工资
 * @returns 时薪
 */
export function calculateHourlyRate(baseSalary: number): number {
  return baseSalary / SALARY_CONSTANTS.WORKDAYS_PER_MONTH / SALARY_CONSTANTS.HOURS_PER_DAY
}

/**
 * 计算加班费
 * @param hours 加班小时数
 * @param hourlyRate 时薪
 * @param type 加班类型
 * @returns 加班费
 */
export function calculateOvertimePay(
  hours: number,
  hourlyRate: number,
  type: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY'
): number {
  const rates = {
    WORKDAY: SALARY_CONSTANTS.WORKDAY_OVERTIME_RATE,
    WEEKEND: SALARY_CONSTANTS.WEEKEND_OVERTIME_RATE,
    HOLIDAY: SALARY_CONSTANTS.HOLIDAY_OVERTIME_RATE,
  }
  return Math.round(hours * hourlyRate * rates[type] * 100) / 100
}

/**
 * 计算加班费分配（超过36小时部分转调休）
 * 优先级说明：
 * - 计薪优先级：节假日 > 周末 > 工作日（因为费率高，优先计薪）
 * - 转调休优先级：工作日 > 周末 > 节假日（优先把费率低的转调休）
 * 
 * @param overtimeData 各类型加班数据
 * @param hourlyRate 时薪
 * @returns 计薪小时数、转调休小时数、加班费
 */
export function calculateOvertimeAllocation(
  overtimeData: { type: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY'; hours: number }[],
  hourlyRate: number
): {
  paidHours: { type: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY'; hours: number }[]
  compensatoryHours: number
  totalPay: number
} {
  // 计算总时长
  const totalHours = overtimeData.reduce((sum, item) => sum + item.hours, 0)
  const maxPaidHours: number = SALARY_CONSTANTS.MAX_OVERTIME_HOURS

  if (totalHours <= maxPaidHours) {
    // 全部计薪
    const totalPay = overtimeData.reduce(
      (sum, item) => sum + calculateOvertimePay(item.hours, hourlyRate, item.type),
      0
    )
    return {
      paidHours: overtimeData,
      compensatoryHours: 0,
      totalPay,
    }
  }

  // 超过36小时，需要转调休
  // 计薪优先级：节假日 > 周末 > 工作日（优先把费率高的计薪）
  // 转调休优先级：工作日 > 周末 > 节假日（优先把费率低的转调休）
  const payPriority = { HOLIDAY: 0, WEEKEND: 1, WORKDAY: 2 }
  const sortedForPay = [...overtimeData].sort(
    (a, b) => payPriority[a.type] - payPriority[b.type]
  )

  let remainingPaidHours = maxPaidHours
  const paidHours: { type: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY'; hours: number }[] = []
  const compensatoryHoursByType: Record<string, number> = { WORKDAY: 0, WEEKEND: 0, HOLIDAY: 0 }

  for (const item of sortedForPay) {
    if (remainingPaidHours <= 0) {
      // 剩余全部转调休，不计费
      compensatoryHoursByType[item.type] += item.hours
    } else if (item.hours <= remainingPaidHours) {
      // 全部计薪
      paidHours.push({ type: item.type, hours: item.hours })
      remainingPaidHours -= item.hours
    } else {
      // 部分计薪，部分转调休
      paidHours.push({ type: item.type, hours: remainingPaidHours })
      compensatoryHoursByType[item.type] += item.hours - remainingPaidHours
      remainingPaidHours = 0
    }
  }

  // 只计算计薪部分的加班费
  const totalPay = paidHours.reduce(
    (sum, item) => sum + calculateOvertimePay(item.hours, hourlyRate, item.type),
    0
  )

  // 转调休的总时长（不计费）
  const compensatoryHours = Object.values(compensatoryHoursByType).reduce((sum, h) => sum + h, 0)

  return {
    paidHours,
    compensatoryHours,
    totalPay,
  }
}

/**
 * 获取上月薪资月份
 * @param date 当前日期
 * @returns 上月月份字符串 YYYY-MM
 */
export function getPreviousMonth(date: Date = new Date()): string {
  const d = new Date(date)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 检查是否可以生成指定月份的薪资
 * 规则：每月20号截止，21号开始可以生成上月薪资
 * @param month 月份 YYYY-MM
 * @returns 是否可以生成
 */
export function canGenerateSalary(month: string): { canGenerate: boolean; message: string } {
  const now = new Date()
  const currentDay = now.getDate()
  
  // 解析目标月份
  const [year, monthNum] = month.split('-').map(Number)
  const targetMonth = new Date(year, monthNum - 1, 1)
  
  // 上个月份
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
  
  // 只能生成上个月的薪资
  if (month !== lastMonthStr) {
    return { canGenerate: false, message: '只能生成上个月的薪资' }
  }
  
  // 必须21号之后
  if (currentDay < SALARY_CONSTANTS.SALARY_CUTOFF_DAY + 1) {
    return { canGenerate: false, message: `每月${SALARY_CONSTANTS.SALARY_CUTOFF_DAY + 1}号之后才能生成上月薪资` }
  }
  
  return { canGenerate: true, message: '' }
}

/**
 * 格式化金额
 * @param amount 金额
 * @returns 格式化后的字符串
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount)
}

/**
 * 格式化小时数
 * @param hours 小时数
 * @returns 格式化后的字符串
 */
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}小时`
}
