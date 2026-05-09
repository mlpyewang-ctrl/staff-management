import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  overtimeSchema,
  leaveSchema,
  performanceSchema,
  positionSchema,
  userProfileSchema,
  userJobAssignmentSchema,
  otherApplicationSchema,
} from '../validations'

describe('loginSchema', () => {
  it('should validate valid login data', () => {
    const result = loginSchema.safeParse({
      username: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject username shorter than 2 characters', () => {
    const result = loginSchema.safeParse({
      username: 'a',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject password shorter than 6 characters', () => {
    const result = loginSchema.safeParse({
      username: 'test@example.com',
      password: '12345',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('should validate valid register data', () => {
    const result = registerSchema.safeParse({
      username: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'EMPLOYEE',
    })
    expect(result.success).toBe(true)
  })

  it('should reject name shorter than 2 characters', () => {
    const result = registerSchema.safeParse({
      username: 'test@example.com',
      password: 'password123',
      name: 'T',
      role: 'EMPLOYEE',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid role', () => {
    const result = registerSchema.safeParse({
      username: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('should accept all valid roles', () => {
    const roles = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const
    roles.forEach((role) => {
      const result = registerSchema.safeParse({
        username: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role,
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('overtimeSchema', () => {
  it('should validate valid overtime data', () => {
    const result = overtimeSchema.safeParse({
      date: '2024-01-15',
      startTime: '09:00',
      endTime: '18:00',
      type: 'WORKDAY',
      reason: 'This is a valid reason for overtime work.',
    })
    expect(result.success).toBe(true)
  })

  it('should reject reason shorter than 10 characters', () => {
    const result = overtimeSchema.safeParse({
      date: '2024-01-15',
      startTime: '09:00',
      endTime: '18:00',
      type: 'WORKDAY',
      reason: 'Too short',
    })
    expect(result.success).toBe(false)
  })

  it('should accept all valid overtime types', () => {
    const types = ['WORKDAY', 'WEEKEND', 'HOLIDAY'] as const
    types.forEach((type) => {
      const result = overtimeSchema.safeParse({
        date: '2024-01-15',
        startTime: '09:00',
        endTime: '18:00',
        type,
        reason: 'This is a valid reason for overtime work.',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('leaveSchema', () => {
  it('should validate valid leave data', () => {
    const result = leaveSchema.safeParse({
      type: 'ANNUAL',
      startDate: '2024-01-15',
      endDate: '2024-01-16',
      startSession: 'AM',
      endSession: 'PM',
      reason: 'This is a valid reason for leave request.',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid same-day session order', () => {
    const result = leaveSchema.safeParse({
      type: 'ANNUAL',
      startDate: '2024-01-15',
      endDate: '2024-01-15',
      startSession: 'PM',
      endSession: 'AM',
      reason: 'This is a valid reason for leave request.',
    })
    expect(result.success).toBe(false)
  })

  it('should reject reason shorter than 10 characters', () => {
    const result = leaveSchema.safeParse({
      type: 'ANNUAL',
      startDate: '2024-01-15',
      endDate: '2024-01-16',
      reason: 'Too short',
    })
    expect(result.success).toBe(false)
  })

  it('should accept all valid leave types', () => {
    const types = ['ANNUAL', 'SICK', 'PERSONAL', 'MARRIAGE', 'MATERNITY', 'PATERNITY', 'COMPENSATORY'] as const
    types.forEach((type) => {
      const result = leaveSchema.safeParse({
        type,
        startDate: '2024-01-15',
        endDate: '2024-01-16',
        startSession: 'AM',
        endSession: 'PM',
        reason: 'This is a valid reason for leave request.',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('performanceSchema', () => {
  it('should validate valid monthly period format', () => {
    const result = performanceSchema.safeParse({
      period: '2024-01',
      quality: 4,
      efficiency: 4,
      attitude: 5,
      skill: 4,
      teamwork: 5,
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid quarterly period format', () => {
    const result = performanceSchema.safeParse({
      period: '2024-Q1',
      quality: 4,
      efficiency: 4,
      attitude: 5,
      skill: 4,
      teamwork: 5,
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid period format', () => {
    const result = performanceSchema.safeParse({
      period: '2024-13',
      quality: 4,
      efficiency: 4,
      attitude: 5,
      skill: 4,
      teamwork: 5,
    })
    expect(result.success).toBe(false)
  })

  it('should reject ratings outside 1-5 range', () => {
    const result = performanceSchema.safeParse({
      period: '2024-01',
      quality: 6,
      efficiency: 4,
      attitude: 5,
      skill: 4,
      teamwork: 5,
    })
    expect(result.success).toBe(false)
  })
})

describe('positionSchema', () => {
  it('should validate valid position data', () => {
    const result = positionSchema.safeParse({
      name: 'Software Engineer',
      departmentId: 'dept-1',
      baseSalary: '50000',
      seniorityPayPerYear: '100',
      maxSeniorityPay: '1000',
    })
    expect(result.success).toBe(true)
  })

  it('should reject name shorter than 2 characters', () => {
    const result = positionSchema.safeParse({
      name: 'S',
      departmentId: 'dept-1',
      baseSalary: '50000',
      seniorityPayPerYear: '100',
      maxSeniorityPay: '1000',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid baseSalary', () => {
    const result = positionSchema.safeParse({
      name: 'Software Engineer',
      departmentId: 'dept-1',
      baseSalary: 'invalid',
      seniorityPayPerYear: '100',
      maxSeniorityPay: '1000',
    })
    expect(result.success).toBe(false)
  })

  it('should reject negative baseSalary', () => {
    const result = positionSchema.safeParse({
      name: 'Software Engineer',
      departmentId: 'dept-1',
      baseSalary: '-100',
      seniorityPayPerYear: '100',
      maxSeniorityPay: '1000',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing departmentId', () => {
    const result = positionSchema.safeParse({
      name: 'Software Engineer',
      baseSalary: '50000',
      seniorityPayPerYear: '100',
      maxSeniorityPay: '1000',
    })
    expect(result.success).toBe(false)
  })
})

describe('userJobAssignmentSchema', () => {
  it('should validate job assignment dates', () => {
    const result = userJobAssignmentSchema.safeParse({
      departmentId: 'dept-1',
      positionId: 'pos-1',
      startDate: '2024-01-15',
      firstWorkDate: '2020-01-15',
    })

    expect(result.success).toBe(true)
  })

  it('should trim empty strings to undefined', () => {
    const result = userJobAssignmentSchema.safeParse({
      departmentId: '',
      positionId: '',
      startDate: '',
      firstWorkDate: '',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.departmentId).toBeUndefined()
      expect(result.data.positionId).toBeUndefined()
      expect(result.data.startDate).toBeUndefined()
      expect(result.data.firstWorkDate).toBeUndefined()
    }
  })
})

describe('userProfileSchema', () => {
  it('should validate supported education values', () => {
    const result = userProfileSchema.safeParse({
      name: '张三',
      education: '本科',
      versionRemark: '学历补录',
    })

    expect(result.success).toBe(true)
  })

  it('should reject unsupported education values', () => {
    const result = userProfileSchema.safeParse({
      name: '张三',
      education: '小学',
    })

    expect(result.success).toBe(false)
  })
})

describe('otherApplicationSchema', () => {
  it('should allow version remark for resume updates', () => {
    const result = otherApplicationSchema.safeParse({
      type: 'RESUME_UPDATE',
      title: '履历更新申请',
      content: '这里是足够长的履历更新说明内容。',
      versionRemark: '新增学历信息',
    })

    expect(result.success).toBe(true)
  })
})
