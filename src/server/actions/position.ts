'use server'

import { prisma } from '@/lib/prisma'

export async function getPositions() {
  return prisma.position.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { users: true },
      },
    },
  })
}

export async function getPosition(id: string) {
  return prisma.position.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

export async function createPosition(formData: FormData) {
  try {
    const name = (formData.get('name') as string) || ''
    const salaryStr = (formData.get('salary') as string) || ''
    const level = (formData.get('level') as string) || ''

    if (!name) {
      return { error: '岗位名称不能为空' }
    }

    const salary = parseFloat(salaryStr)
    if (isNaN(salary) || salary < 0) {
      return { error: '请输入有效的薪资数额' }
    }

    const position = await prisma.position.create({
      data: {
        name,
        salary,
        level: level || null,
      },
    })

    return { success: '岗位已创建', position }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: '岗位名称已存在' }
    }
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '创建岗位失败，请稍后重试' }
  }
}

export async function updatePosition(id: string, formData: FormData) {
  try {
    const name = (formData.get('name') as string) || ''
    const salaryStr = (formData.get('salary') as string) || ''
    const level = (formData.get('level') as string) || ''

    if (!name) {
      return { error: '岗位名称不能为空' }
    }

    const salary = parseFloat(salaryStr)
    if (isNaN(salary) || salary < 0) {
      return { error: '请输入有效的薪资数额' }
    }

    const position = await prisma.position.update({
      where: { id },
      data: {
        name,
        salary,
        level: level || null,
      },
    })

    return { success: '岗位已更新', position }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: '岗位名称已存在' }
    }
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新岗位失败，请稍后重试' }
  }
}

export async function deletePosition(id: string) {
  try {
    const usersCount = await prisma.user.count({
      where: { positionId: id },
    })

    if (usersCount > 0) {
      return { error: `该岗位下有 ${usersCount} 名员工，无法删除` }
    }

    await prisma.position.delete({
      where: { id },
    })

    return { success: '岗位已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除岗位失败，请稍后重试' }
  }
}
