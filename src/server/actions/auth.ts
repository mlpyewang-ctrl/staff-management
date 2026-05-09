'use server'

import { ensureLeaveBalance } from '@/lib/leave-balance'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { registerSchema, createUserSchema, changePasswordSchema } from '@/lib/validations'
import { requireSessionUser } from '@/lib/action-auth'
import { revalidatePath } from 'next/cache'

export async function registerUser(formData: FormData) {
  try {
    const validatedData = registerSchema.parse({
      username: formData.get('username'),
      password: formData.get('password'),
      name: formData.get('name'),
      role: formData.get('role') || undefined,
      companyId: formData.get('companyId') || null,
    })

    let role = 'EMPLOYEE'

    try {
      const sessionUser = await requireSessionUser()
      if (sessionUser.role === 'ADMIN') {
        role = validatedData.role
      }
    } catch {
      role = 'EMPLOYEE'
    }

    // 检查账户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username: validatedData.username },
    })

    if (existingUser) {
      return { error: '该账户名已被注册' }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username: validatedData.username,
        password: hashedPassword,
        name: validatedData.name,
        role,
        companyId: validatedData.companyId,
      },
    })

    // 如果是员工，创建当年的默认假期余额
    if (role === 'EMPLOYEE') {
      await ensureLeaveBalance(user.id)
    }

    revalidatePath('/auth/login')
    return { success: '注册成功，请登录' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '注册失败，请稍后重试' }
  }
}

const DEFAULT_PASSWORD = 'Aa@12345!'

export async function createUser(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    if (sessionUser.role !== 'ADMIN') {
      return { error: '无权操作' }
    }

    const validatedData = createUserSchema.parse({
      username: formData.get('username'),
      name: formData.get('name'),
      role: formData.get('role') || undefined,
    })

    // 检查账户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username: validatedData.username },
    })

    if (existingUser) {
      return { error: '该账户名已存在' }
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10)

    const user = await prisma.user.create({
      data: {
        username: validatedData.username,
        password: hashedPassword,
        name: validatedData.name,
        role: validatedData.role,
      },
    })

    if (validatedData.role === 'EMPLOYEE' || validatedData.role === 'ATTENDANCE_CLERK') {
      await ensureLeaveBalance(user.id)
    }

    revalidatePath('/dashboard/staff')
    return { success: '账号创建成功' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '创建失败，请稍后重试' }
  }
}

export async function changePassword(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()

    const validatedData = changePasswordSchema.parse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    })

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    })

    if (!user) {
      return { error: '用户不存在' }
    }

    const isPasswordValid = await bcrypt.compare(
      validatedData.currentPassword,
      user.password
    )

    if (!isPasswordValid) {
      return { error: '当前密码错误' }
    }

    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10)

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { password: hashedPassword },
    })

    return { success: '密码修改成功' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '修改密码失败，请稍后重试' }
  }
}

export async function createInitialAdmin() {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    })

    if (existingAdmin) {
      return
    }

    const hashedPassword = await bcrypt.hash('admin123', 10)

    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        role: 'ADMIN',
      },
    })

    console.log('初始管理员账号已创建：admin@example.com / admin123')
  } catch (error) {
    console.error('创建初始管理员失败:', error)
  }
}
