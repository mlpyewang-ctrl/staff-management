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

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type LeaveType = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'MARRIAGE' | 'MATERNITY' | 'PATERNITY'

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
