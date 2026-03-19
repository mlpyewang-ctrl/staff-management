export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

// NextAuth type extensions
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      companyId?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: Role
    companyId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    companyId?: string | null
  }
}

export interface User {
  id: string
  email: string
  name: string
  role: Role
  companyId?: string | null
}

export type ApplicationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export type LeaveType =
  | 'ANNUAL'
  | 'SICK'
  | 'PERSONAL'
  | 'MARRIAGE'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'COMPENSATORY'

export type ApplicationType = 'OVERTIME' | 'LEAVE'

export interface OvertimeApplication {
  id: string
  userId: string
  date: Date
  startTime: Date
  endTime: Date
  hours: number
  reason: string
  status: ApplicationStatus
  approverId?: string | null
  approvedAt?: Date | null
  remark?: string | null
  createdAt: Date
  updatedAt: Date
  userName?: string
}

export interface LeaveApplication {
  id: string
  userId: string
  type: LeaveType
  startDate: Date
  endDate: Date
  days: number
  reason: string
  status: ApplicationStatus
  approverId?: string | null
  approvedAt?: Date | null
  remark?: string | null
  createdAt: Date
  updatedAt: Date
  userName?: string
  leaveTypeText?: string
}

export interface LeaveBalance {
  id: string
  userId: string
  year: number
  annual: number
  sick: number
  personal: number
  compensatory?: number
  usedCompensatory?: number
}

export interface PerformanceReview {
  id: string
  userId: string
  period: string
  quality: number
  efficiency: number
  attitude: number
  skill: number
  teamwork: number
  totalScore: number
  comment?: string | null
  reviewerId?: string | null
  createdAt: Date
  updatedAt: Date
  userName?: string
}

export interface Approval {
  id: string
  applicationId: string
  applicationType: ApplicationType
  applicantId: string
  approverId: string
  status: ApplicationStatus
  remark?: string | null
  createdAt: Date
  applicantName?: string
  applicationDate?: Date
}

// ========== 新增：薪资和调休相关类型 ==========

export type SalaryStatus = 'DRAFT' | 'CONFIRMED' | 'PAID'

export type OvertimeType = 'WORKDAY' | 'WEEKEND' | 'HOLIDAY'

export type SettlementType = 'SALARY' | 'COMPENSATORY'

export type HolidayType = 'LEGAL_HOLIDAY' | 'COMPENSATORY'

export interface Holiday {
  id: string
  name: string
  date: Date
  year: number
  type: HolidayType
  createdAt: Date
}

export interface SalaryRecord {
  id: string
  userId: string
  month: string
  baseSalary: number
  workdayOvertimeHours: number
  workdayOvertimePay: number
  weekendOvertimeHours: number
  weekendOvertimePay: number
  holidayOvertimeHours: number
  holidayOvertimePay: number
  totalOvertimePay: number
  compensatoryHours: number
  deduction: number
  netSalary: number
  status: SalaryStatus
  paidAt?: Date | null
  createdAt: Date
  updatedAt: Date
  userName?: string
  departmentName?: string
  positionName?: string
}

export interface OvertimeSettlement {
  id: string
  userId: string
  overtimeId: string
  salaryRecordId?: string | null
  hours: number
  settlementType: SettlementType
  createdAt: Date
}

export interface CompensatoryLeaveInfo {
  totalCompensatory: number       // 累计调休（小时）
  availableCompensatory: number   // 可用调休（小时）
  usedCompensatory: number        // 已使用调休（小时）
  settledOvertimeHours: number    // 已清算加班时长（小时）
}

// 薪资计算参数
export const SALARY_CONSTANTS = {
  WORKDAYS_PER_MONTH: 21.75,      // 月计薪天数
  HOURS_PER_DAY: 8,               // 每天工作小时数
  MAX_OVERTIME_HOURS: 36,         // 每月最大加班小时数（超过转调休）
  WORKDAY_OVERTIME_RATE: 1.5,     // 工作日加班倍率
  WEEKEND_OVERTIME_RATE: 2.0,     // 周末加班倍率
  HOLIDAY_OVERTIME_RATE: 3.0,     // 法定节假日加班倍率
  FULL_DAY_HOURS: 8,              // 一天调休小时数
  HALF_DAY_HOURS: 4,              // 半天调休小时数
  SALARY_CUTOFF_DAY: 20,          // 薪资截止日（每月20号）
} as const
