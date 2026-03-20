'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { requireSessionUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { performanceSchema } from '@/lib/validations'

async function requirePerformanceOwnerOrManager(id: string) {
  const sessionUser = await requireSessionUser()
  const review = await prisma.performanceReview.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
    },
  })

  if (!review) {
    return {
      sessionUser,
      review: null,
    }
  }

  if (sessionUser.role === 'EMPLOYEE' && sessionUser.id !== review.userId) {
    throw new Error('无权操作该绩效记录')
  }

  return {
    sessionUser,
    review,
  }
}

function buildScorePayload(formData: FormData) {
  return performanceSchema.parse({
    period: formData.get('period'),
    quality: Number(formData.get('quality')),
    efficiency: Number(formData.get('efficiency')),
    attitude: Number(formData.get('attitude')),
    skill: Number(formData.get('skill')),
    teamwork: Number(formData.get('teamwork')),
    comment: formData.get('comment'),
    selfComment: formData.get('selfComment'),
  })
}

function calculateTotalScore(validatedData: ReturnType<typeof buildScorePayload>) {
  return (
    validatedData.quality +
    validatedData.efficiency +
    validatedData.attitude +
    validatedData.skill +
    validatedData.teamwork
  ) / 5
}

export async function createPerformanceReview(formData: FormData) {
  try {
    const sessionUser = await requireSessionUser()
    const validatedData = buildScorePayload(formData)
    const totalScore = calculateTotalScore(validatedData)

    const existing = await prisma.performanceReview.findFirst({
      where: {
        userId: sessionUser.id,
        period: validatedData.period,
      },
    })

    if (existing) {
      return { error: '该期间的绩效已存在' }
    }

    const action = formData.get('action') === 'submit' ? 'submit' : 'save'
    const created = await prisma.performanceReview.create({
      data: {
        userId: sessionUser.id,
        period: validatedData.period,
        quality: validatedData.quality,
        efficiency: validatedData.efficiency,
        attitude: validatedData.attitude,
        skill: validatedData.skill,
        teamwork: validatedData.teamwork,
        totalScore,
        comment: validatedData.comment,
        selfComment: validatedData.selfComment,
        reviewerId: sessionUser.id,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/performance')
    return {
      success: action === 'submit' ? '绩效记录已提交' : '绩效草稿已保存',
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

export async function updatePerformanceReview(formData: FormData) {
  try {
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
      return { error: '缺少绩效记录 ID' }
    }

    const validatedData = buildScorePayload(formData)
    const totalScore = calculateTotalScore(validatedData)
    const { review } = await requirePerformanceOwnerOrManager(id)

    if (!review) {
      return { error: '绩效记录不存在' }
    }

    await prisma.performanceReview.update({
      where: { id },
      data: {
        period: validatedData.period,
        quality: validatedData.quality,
        efficiency: validatedData.efficiency,
        attitude: validatedData.attitude,
        skill: validatedData.skill,
        teamwork: validatedData.teamwork,
        totalScore,
        comment: validatedData.comment,
        selfComment: validatedData.selfComment,
        status: formData.get('action') === 'submit' ? 'PENDING' : undefined,
      },
    })

    revalidatePath('/dashboard/performance')
    return {
      success: formData.get('action') === 'submit' ? '绩效记录已提交' : '绩效记录已保存',
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function deletePerformanceReview(id: string) {
  try {
    if (!id) {
      return { error: '缺少绩效记录 ID' }
    }

    const { review } = await requirePerformanceOwnerOrManager(id)

    if (!review) {
      return { error: '绩效记录不存在' }
    }

    await prisma.performanceReview.delete({
      where: { id },
    })

    revalidatePath('/dashboard/performance')
    return { success: '绩效记录已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除失败，请稍后重试' }
  }
}

export async function getPerformanceReviews(_userId?: string, _role?: string) {
  try {
    const sessionUser = await requireSessionUser()
    const where: Prisma.PerformanceReviewWhereInput =
      sessionUser.role === 'EMPLOYEE'
        ? {
            userId: sessionUser.id,
          }
        : {}

    const reviews = await prisma.performanceReview.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { period: 'desc' },
    })

    return reviews.map((review) => ({
      ...review,
      userName: review.user.name,
      reviewerName: review.reviewer?.name || null,
    }))
  } catch (error) {
    console.error('获取绩效记录失败:', error)
    return []
  }
}

export async function getPerformanceReview(id: string) {
  try {
    const sessionUser = await requireSessionUser()
    const review = await prisma.performanceReview.findUnique({
      where: { id },
    })

    if (!review) {
      return null
    }

    if (sessionUser.role === 'EMPLOYEE' && sessionUser.id !== review.userId) {
      return null
    }

    return review
  } catch (error) {
    console.error('获取绩效详情失败:', error)
    return null
  }
}
