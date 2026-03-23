import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    position: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getServerSession } from 'next-auth'

import { prisma } from '@/lib/prisma'

import { updateUserJobAssignment } from '../user'

const mockPrisma = vi.mocked(prisma)
const mockGetServerSession = vi.mocked(getServerSession)

describe('updateUserJobAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
      },
      expires: '2099-01-01T00:00:00.000Z',
    })
  })

  it('should allow admin to promote a user to manager', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      positionId: 'old-position',
    } as never)
    mockPrisma.department.findUnique.mockResolvedValue({ id: 'dept-1' } as never)
    mockPrisma.position.findUnique.mockResolvedValue({ id: 'pos-1' } as never)
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'Staff',
      email: 'staff@example.com',
      role: 'MANAGER',
      level: 'P6',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      department: { id: 'dept-1', name: '研发部' },
      position: { id: 'pos-1', name: '工程师', level: 'P6', salary: 10000 },
    } as never)

    const formData = new FormData()
    formData.append('departmentId', 'dept-1')
    formData.append('positionId', 'pos-1')
    formData.append('level', 'P6')
    formData.append('role', 'MANAGER')

    const result = await updateUserJobAssignment('user-1', formData)

    expect(result).toEqual(
      expect.objectContaining({
        success: '人员信息已更新',
        user: expect.objectContaining({ role: 'MANAGER' }),
      })
    )
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departmentId: 'dept-1',
          positionId: 'pos-1',
          level: 'P6',
          role: 'MANAGER',
          salary: null,
        }),
      })
    )
  })

  it('should reject assigning admin role from this page', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      positionId: null,
    } as never)

    const formData = new FormData()
    formData.append('role', 'ADMIN')

    const result = await updateUserJobAssignment('user-1', formData)

    expect(result).toEqual({ error: '不能在此页面将人员设置为管理员' })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('should keep existing admin role unchanged when role is omitted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin-2',
      role: 'ADMIN',
      positionId: null,
    } as never)
    mockPrisma.user.update.mockResolvedValue({
      id: 'admin-2',
      name: 'Root Admin',
      email: 'root@example.com',
      role: 'ADMIN',
      level: null,
      departmentId: null,
      positionId: null,
      department: null,
      position: null,
    } as never)

    const formData = new FormData()

    const result = await updateUserJobAssignment('admin-2', formData)

    expect(result).toEqual(
      expect.objectContaining({
        success: '人员信息已更新',
        user: expect.objectContaining({ role: 'ADMIN' }),
      })
    )
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ role: expect.anything() }),
      })
    )
  })
})
