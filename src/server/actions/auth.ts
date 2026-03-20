'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { registerSchema } from '@/lib/validations'
import { requireSessionUser } from '@/lib/action-auth'
import { revalidatePath } from 'next/cache'

export async function registerUser(formData: FormData) {
  try {
    const validatedData = registerSchema.parse({
      email: formData.get('email'),
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

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return { error: '该邮箱已被注册' }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role,
        companyId: validatedData.companyId,
      },
    })

    // 如果是员工，创建当年的默认假期余额
    if (role === 'EMPLOYEE') {
      await prisma.leaveBalance.create({
        data: {
          userId: user.id,
          year: new Date().getFullYear(),
        },
      })
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
        email: 'admin@example.com',
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
