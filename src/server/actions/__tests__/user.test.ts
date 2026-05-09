import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EDUCATION_OPTIONS } from '@/lib/profile-versioning'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    userProfileChangeLog: {
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    position: {
      findUnique: vi.fn(),
    },
  },
}))

Object.assign(prismaMock, {
  $transaction: vi.fn(),
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/leave-balance', () => ({
  ensureLeaveBalance: vi.fn().mockResolvedValue(null),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getServerSession } from 'next-auth'

import { prisma } from '@/lib/prisma'

import { updateUserJobAssignment, updateUserProfile } from '../user'

type MockFn = ReturnType<typeof vi.fn>

type PrismaMock = {
  $transaction: MockFn
  user: {
    findUnique: MockFn
    update: MockFn
    findMany: MockFn
  }
  userProfileChangeLog: {
    create: MockFn
  }
  department: {
    findUnique: MockFn
  }
  position: {
    findUnique: MockFn
  }
}

const mockPrisma = prisma as unknown as PrismaMock
const mockGetServerSession = vi.mocked(getServerSession)

describe('user actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        username: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
      },
      expires: '2099-01-01T00:00:00.000Z',
    })

    mockPrisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(mockPrisma as never)
      }

      return Promise.all(input as Promise<unknown>[])
    })
  })

  it('should record a change log when profile fields change', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      name: '张三',
      username: 'zhangsan@example.com',
      role: 'EMPLOYEE',
      education: EDUCATION_OPTIONS[0],
      idCard: null,
      phone: '13800000000',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      level: 'P5',
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      department: { name: '研发部' },
      position: { name: '工程师' },
    } as never)
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      name: '张三',
      username: 'zhangsan@example.com',
      role: 'EMPLOYEE',
      education: EDUCATION_OPTIONS[4],
      idCard: null,
      phone: '13800000000',
      department: { name: '研发部' },
      position: { name: '工程师' },
    } as never)

    const formData = new FormData()
    formData.append('name', '李四')
    formData.append('phone', '13800000000')

    const result = await updateUserProfile('user-1', formData)

    expect(result).toEqual(
      expect.objectContaining({
        success: '个人信息已更新，并已记录变更',
      })
    )
    expect(mockPrisma.userProfileChangeLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it('should record a change log when job assignment changes', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      name: 'Staff',
      username: 'staff@example.com',
      role: 'EMPLOYEE',
      education: EDUCATION_OPTIONS[0],
      idCard: null,
      phone: null,
      positionId: 'old-position',
      departmentId: 'old-dept',
      level: 'P5',
      startDate: new Date('2024-01-15T00:00:00.000Z'),
      salary: 8000,
      department: { name: '旧部门' },
      position: { name: '旧岗位', hasSeniorityPay: true, seniorityPayPerYear: 100, maxSeniorityPay: 1000 },
    } as never)
    mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept-1', name: '研发部' } as never)
    mockPrisma.position.findUnique.mockResolvedValue({ id: 'pos-1', name: '工程师', hasSeniorityPay: true, seniorityPayPerYear: 100, maxSeniorityPay: 1000 } as never)
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'Staff',
      username: 'staff@example.com',
      role: 'MANAGER',
      education: EDUCATION_OPTIONS[0],
      level: 'P6',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      department: { id: 'dept-1', name: '研发部' },
      position: { id: 'pos-1', name: '工程师', departmentId: 'dept-1', baseSalary: 10000, hasSeniorityPay: true, seniorityPayPerYear: 100, maxSeniorityPay: 1000 },
    } as never)

    const formData = new FormData()
    formData.append('departmentId', 'dept-1')
    formData.append('positionId', 'pos-1')
    formData.append('role', 'MANAGER')
    formData.append('startDate', '2024-01-15')

    const result = await updateUserJobAssignment('user-1', formData)

    expect(result).toEqual(
      expect.objectContaining({
        success: '人员信息已更新，并已记录变更',
        user: expect.objectContaining({ role: 'MANAGER' }),
      })
    )
    expect(mockPrisma.userProfileChangeLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departmentId: 'dept-1',
          positionId: 'pos-1',
          role: 'MANAGER',
          salary: null,
        }),
      })
    )
  })

  it('should reject assigning admin role from this page', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      name: 'Staff',
      username: 'staff@example.com',
      role: 'EMPLOYEE',
      education: null,
      idCard: null,
      phone: null,
      positionId: null,
      departmentId: null,
      level: null,
      startDate: null,
      salary: null,
      department: null,
      position: null,
    } as never)

    const formData = new FormData()
    formData.append('role', 'ADMIN')

    const result = await updateUserJobAssignment('user-1', formData)

    expect(result).toEqual({ error: '不能在此页面将人员设为管理员' })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
