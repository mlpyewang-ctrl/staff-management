'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { requireSessionUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { otherApplicationSchema } from '@/lib/validations'

const otherApplicationTypeMap: Record<string, string> = {
  RESIGNATION_HANDOVER: '离职交接',
  RESUME_UPDATE: '履历更新',
  PARTY_INFO_UPDATE: '党员信息更新',
}

export async function getOtherApplicationTypeLabel(type: string) {
  return otherApplicationTypeMap[type] || type
}

async function requireOtherApplicationOwnerOrAdmin(id: string) {
  const sessionUser = await requireSessionUser()
  const application = await prisma.otherApplication.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  })

  if (!application) {
    return {
      sessionUser,
      application: null,
    }
  }

  if (sessionUser.role !== 'ADMIN' && sessionUser.id !== application.userId) {
    throw new Error('无权操作该申请')
  }

  return {
    sessionUser,
    application,
  }
}

export async function createOtherApplication(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const action = formData.get('action') === 'submit' ? 'submit' : 'save'

    const validatedData = otherApplicationSchema.parse({
      type: formData.get('type'),
      title: formData.get('title'),
      content: formData.get('content'),
      attachments: formData.get('attachments'),
    })

    const created = await prisma.otherApplication.create({
      data: {
        userId: sessionUser.id,
        type: validatedData.type,
        title: validatedData.title,
        content: validatedData.content,
        attachments: validatedData.attachments || null,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/other')

    const typeLabel = otherApplicationTypeMap[validatedData.type]

    return {
      success: action === 'submit' ? `${typeLabel}申请已提交` : `${typeLabel}草稿已保存`,
      id: created.id,
      status: created.status,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交失败，请稍后重试' }
  }
}

export async function getOtherApplication(id: string) {
  try {
    const sessionUser = await requireSessionUser()
    const application = await prisma.otherApplication.findUnique({
      where: { id },
    })

    if (!application) {
      return null
    }

    if (sessionUser.role === 'EMPLOYEE' && application.userId !== sessionUser.id) {
      return null
    }

    return application
  } catch (error) {
    console.error('获取申请详情失败:', error)
    return null
  }
}

export async function updateOtherApplication(formData: FormData) {
  try {
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
      return { error: '缺少申请 ID' }
    }

    const { application } = await requireOtherApplicationOwnerOrAdmin(id)

    if (!application) {
      return { error: '申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的申请可以修改' }
    }

    const validatedData = otherApplicationSchema.parse({
      type: formData.get('type'),
      title: formData.get('title'),
      content: formData.get('content'),
      attachments: formData.get('attachments'),
    })

    const action = formData.get('action') === 'submit' ? 'submit' : 'save'
    const nextStatus = action === 'submit' ? 'PENDING' : 'DRAFT'

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: {
            in: ['RESIGNATION_HANDOVER', 'RESUME_UPDATE', 'PARTY_INFO_UPDATE'],
          },
        },
      }),
      prisma.otherApplication.update({
        where: { id },
        data: {
          type: validatedData.type,
          title: validatedData.title,
          content: validatedData.content,
          attachments: validatedData.attachments || null,
          status: nextStatus,
          approverId: null,
          approvedAt: null,
          remark: null,
        },
      }),
    ])

    revalidatePath('/dashboard/other')

    const typeLabel = otherApplicationTypeMap[validatedData.type]

    return {
      success: nextStatus === 'PENDING' ? `${typeLabel}申请已提交` : `${typeLabel}申请已保存为草稿`,
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function deleteOtherApplication(id: string) {
  try {
    if (!id) {
      return { error: '缺少申请 ID' }
    }

    const { application } = await requireOtherApplicationOwnerOrAdmin(id)

    if (!application) {
      return { error: '申请不存在' }
    }

    if (application.status !== 'DRAFT') {
      return { error: '只有草稿状态的申请可以删除' }
    }

    await prisma.$transaction([
      prisma.approval.deleteMany({
        where: {
          applicationId: id,
          applicationType: {
            in: ['RESIGNATION_HANDOVER', 'RESUME_UPDATE', 'PARTY_INFO_UPDATE'],
          },
        },
      }),
      prisma.otherApplication.delete({
        where: { id },
      }),
    ])

    revalidatePath('/dashboard/other')
    return { success: '申请已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function getOtherApplications(_userId?: string, _role?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const where: Prisma.OtherApplicationWhereInput =
      sessionUser.role === 'EMPLOYEE'
        ? {
            userId: sessionUser.id,
          }
        : {}

    const applications = await prisma.otherApplication.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return applications.map((application) => ({
      ...application,
      userName: application.user.name,
      typeText: otherApplicationTypeMap[application.type] || application.type,
    }))
  } catch (error) {
    console.error('获取申请列表失败:', error)
    return []
  }
}
