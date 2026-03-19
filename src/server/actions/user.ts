'use server'

import { prisma } from '@/lib/prisma'
import { userProfileSchema } from '@/lib/validations'

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      position: true,
    },
  })

  return user
}

export async function updateUserProfile(userId: string, formData: FormData) {
  try {
    const getString = (key: string) => {
      const v = formData.get(key)
      return typeof v === 'string' ? v : undefined
    }

    const validated = userProfileSchema.parse({
      name: getString('name'),
      idCard: getString('idCard'),
      phone: getString('phone'),
      salary: getString('salary'),
      level: getString('level'),
      departmentId: getString('departmentId'),
      positionId: getString('positionId'),
      startDate: getString('startDate'),
    })

    const startDate =
      validated.startDate && validated.startDate !== ''
        ? new Date(validated.startDate)
        : undefined

    // If positionId is provided, get the salary and level from the position
    let salaryData = validated.salary
    let levelData = validated.level

    if (validated.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: validated.positionId },
      })
      if (position) {
        salaryData = position.salary
        levelData = position.level || undefined
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: validated.name,
        idCard: validated.idCard || null,
        phone: validated.phone || null,
        salary: salaryData,
        level: levelData || null,
        departmentId: validated.departmentId || null,
        positionId: validated.positionId || null,
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

