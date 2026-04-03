'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const announcementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200字'),
  content: z.string().min(1, '内容不能为空'),
  isActive: z.boolean().default(true),
})

export type AnnouncementInput = z.infer<typeof announcementSchema>

export interface Announcement {
  id: string
  title: string
  content: string
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// 获取当前有效的公示（所有人可见）
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  const announcement = await prisma.announcement.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  })
  return announcement as Announcement | null
}

// 获取所有公示（仅 ADMIN）
export async function getAnnouncements(): Promise<Announcement[]> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const announcements = await prisma.announcement.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return announcements as Announcement[]
}

// 创建公示（仅 ADMIN）
export async function createAnnouncement(data: AnnouncementInput): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = announcementSchema.parse(data)

    // 如果设置为生效，先取消其他所有生效的公示
    if (validated.isActive) {
      await prisma.announcement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
    }

    await prisma.announcement.create({
      data: {
        ...validated,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/announcements')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: '创建失败' }
  }
}

// 更新公示（仅 ADMIN）
export async function updateAnnouncement(
  id: string,
  data: AnnouncementInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = announcementSchema.parse(data)

    // 如果设置为生效，先取消其他所有生效的公示
    if (validated.isActive) {
      await prisma.announcement.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      })
    }

    await prisma.announcement.update({
      where: { id },
      data: validated,
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/announcements')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: '更新失败' }
  }
}

// 删除公示（仅 ADMIN）
export async function deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    await prisma.announcement.delete({
      where: { id },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/announcements')
    return { success: true }
  } catch {
    return { success: false, error: '删除失败' }
  }
}

// 获取单个公示详情（仅 ADMIN）
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return null
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
  })
  return announcement as Announcement | null
}

// 切换公示生效状态（仅 ADMIN）
export async function toggleAnnouncementStatus(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    // 如果要设置为生效，先取消其他所有生效的公示
    if (isActive) {
      await prisma.announcement.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      })
    }

    await prisma.announcement.update({
      where: { id },
      data: { isActive },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/announcements')
    return { success: true }
  } catch {
    return { success: false, error: '操作失败' }
  }
}
