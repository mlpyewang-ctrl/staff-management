'use server'

import { prisma } from '@/lib/prisma'

export async function getDepartments() {
  return prisma.department.findMany({
    orderBy: { createdAt: 'asc' },
  })
}

export async function createDepartment(formData: FormData) {
  try {
    const name = (formData.get('name') as string) || ''
    const code = (formData.get('code') as string) || ''

    if (!name || !code) {
      return { error: '名称和编码不能为空' }
    }

    const dept = await prisma.department.create({
      data: {
        name,
        code,
      },
    })

    return { success: '部门已创建', department: dept }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '创建部门失败，请稍后重试' }
  }
}

export async function updateDepartment(id: string, formData: FormData) {
  try {
    const name = (formData.get('name') as string) || ''
    const code = (formData.get('code') as string) || ''

    if (!name || !code) {
      return { error: '名称和编码不能为空' }
    }

    const dept = await prisma.department.update({
      where: { id },
      data: {
        name,
        code,
      },
    })

    return { success: '部门已更新', department: dept }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新部门失败，请稍后重试' }
  }
}

export async function assignUserDepartment(userId: string, departmentId: string | null) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        departmentId: departmentId,
      },
    })
    return { success: '用户部门已更新' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新用户部门失败，请稍后重试' }
  }
}

