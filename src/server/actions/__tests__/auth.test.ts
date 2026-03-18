import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    leaveBalance: {
      create: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$hashedpassword'),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { registerUser, createInitialAdmin } from '../auth'

const mockPrisma = vi.mocked(prisma)
const mockBcrypt = vi.mocked(bcrypt)

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new user successfully', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'EMPLOYEE',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    mockPrisma.leaveBalance.create.mockResolvedValue({} as any)

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Test User')
    formData.append('role', 'EMPLOYEE')

    const result = await registerUser(formData)

    expect(result).toEqual({ success: '注册成功，请登录' })
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10)
    expect(mockPrisma.leaveBalance.create).toHaveBeenCalled()
  })

  it('should return error if email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'existing@example.com',
    } as any)

    const formData = new FormData()
    formData.append('email', 'existing@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Test User')
    formData.append('role', 'EMPLOYEE')

    const result = await registerUser(formData)

    expect(result).toEqual({ error: '该邮箱已被注册' })
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('should return error for invalid email', async () => {
    const formData = new FormData()
    formData.append('email', 'invalid-email')
    formData.append('password', 'password123')
    formData.append('name', 'Test User')
    formData.append('role', 'EMPLOYEE')

    const result = await registerUser(formData)

    expect(result).toHaveProperty('error')
  })

  it('should return error for password shorter than 6 characters', async () => {
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', '12345')
    formData.append('name', 'Test User')
    formData.append('role', 'EMPLOYEE')

    const result = await registerUser(formData)

    expect(result).toHaveProperty('error')
  })

  it('should not create leave balance for non-employee users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const formData = new FormData()
    formData.append('email', 'admin@example.com')
    formData.append('password', 'password123')
    formData.append('name', 'Admin User')
    formData.append('role', 'ADMIN')

    const result = await registerUser(formData)

    expect(result).toEqual({ success: '注册成功，请登录' })
    expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled()
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
      name: '系统管理员',
      role: 'ADMIN',
      password: '$2a$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    await createInitialAdmin()

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'admin@example.com',
        password: '$2a$10$hashedpassword',
        name: '系统管理员',
        role: 'ADMIN',
      },
    })
  })

  it('should not create admin if one already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: '1',
      email: 'existing-admin@example.com',
      role: 'ADMIN',
    } as any)

    await createInitialAdmin()

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })
})
