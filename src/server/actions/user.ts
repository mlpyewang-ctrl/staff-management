'use server'

import { prisma } from '@/lib/prisma'
import { userProfileSchema } from '@/lib/validations'

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
    },
  })

  return user
}

export async function updateUserProfile(userId: string, formData: FormData) {
  try {
    const validated = userProfileSchema.parse({
      name: formData.get('name'),
      idCard: formData.get('idCard'),
      phone: formData.get('phone'),
      salary: formData.get('salary'),
      level: formData.get('level'),
      departmentId: formData.get('departmentId'),
      startDate: formData.get('startDate'),
    })

    const startDate =
      validated.startDate && validated.startDate !== ''
        ? new Date(validated.startDate)
        : undefined

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: validated.name,
        idCard: validated.idCard || null,
        phone: validated.phone || null,
        salary: validated.salary,
        level: validated.level || null,
        departmentId: validated.departmentId || null,
        startDate: startDate,
      },
    })

    return { success: '个人信息已更新', user }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

