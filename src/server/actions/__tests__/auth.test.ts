import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/leave-balance', () => ({
  ensureLeaveBalance: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$hashedpassword'),
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getServerSession } from 'next-auth'

import { ensureLeaveBalance } from '@/lib/leave-balance'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

import { createInitialAdmin, registerUser } from '../auth'

const mockPrisma = vi.mocked(prisma)
const mockEnsureLeaveBalance = vi.mocked(ensureLeaveBalance)
const mockBcrypt = vi.mocked(bcrypt)
const mockGetServerSession = vi.mocked(getServerSession)

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue(null)
    mockEnsureLeaveBalance.mockResolvedValue({} as never)
  })

  it('should register a new employee successfully', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'EMPLOYEE',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Test User')

    const result = await registerUser(formData)

    expect(result).toEqual({ success: '注册成功，请登录' })
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10)
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        name: 'Test User',
        role: 'EMPLOYEE',
      }),
    })
    expect(mockEnsureLeaveBalance).toHaveBeenCalledWith('1')
  })

  it('should prevent unauthenticated users from self-registering as admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'EMPLOYEE',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    const formData = new FormData()
    formData.append('email', 'admin@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Admin User')
    formData.append('role', 'ADMIN')

    const result = await registerUser(formData)

    expect(result).toEqual({ success: '注册成功，请登录' })
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'EMPLOYEE',
      }),
    })
    expect(mockEnsureLeaveBalance).toHaveBeenCalledWith('1')
  })

  it('should allow admins to create non-employee accounts', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'root@example.com',
        name: 'Root',
        role: 'ADMIN',
      },
      expires: '2099-01-01T00:00:00.000Z',
    })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'manager@example.com',
      name: 'Manager User',
      role: 'MANAGER',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const formData = new FormData()
    formData.append('email', 'manager@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Manager User')
    formData.append('role', 'MANAGER')

    const result = await registerUser(formData)

    expect(result).toEqual({ success: '注册成功，请登录' })
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'MANAGER',
      }),
    })
    expect(mockEnsureLeaveBalance).not.toHaveBeenCalled()
  })

  it('should return error if email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'existing@example.com',
    } as never)

    const formData = new FormData()
    formData.append('email', 'existing@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Test User')

    const result = await registerUser(formData)

    expect(result).toHaveProperty('error')
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('should return error for invalid email', async () => {
    const formData = new FormData()
    formData.append('email', 'invalid-email')
    formData.append('password', 'password123')
    formData.append('name', 'Test User')

    const result = await registerUser(formData)

    expect(result).toHaveProperty('error')
  })

  it('should return error for password shorter than 6 characters', async () => {
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', '12345')
    formData.append('name', 'Test User')

    const result = await registerUser(formData)

    expect(result).toHaveProperty('error')
  })
})

describe('createInitialAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create initial admin if none exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      name: 'System Admin',
      role: 'ADMIN',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    await createInitialAdmin()

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'admin@example.com',
        password: '$2a$10$hashedpassword',
        role: 'ADMIN',
      }),
    })
  })

  it('should not create admin if one already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: '1',
      email: 'existing-admin@example.com',
      role: 'ADMIN',
    } as never)

    await createInitialAdmin()

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })
})
