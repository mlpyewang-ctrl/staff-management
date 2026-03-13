'use server'

import { prisma } from '@/lib/prisma'
import { performanceSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

export async function createPerformanceReview(formData: FormData) {
  try {
    const validatedData = performanceSchema.parse({
      period: formData.get('period'),
      quality: parseInt(formData.get('quality') as string),
      efficiency: parseInt(formData.get('efficiency') as string),
      attitude: parseInt(formData.get('attitude') as string),
      skill: parseInt(formData.get('skill') as string),
      teamwork: parseInt(formData.get('teamwork') as string),
      comment: formData.get('comment'),
    })

    const userId = formData.get('userId') as string
    const reviewerId = formData.get('reviewerId') as string

    if (!userId) {
      return { error: '用户未登录' }
    }

    // 计算总分（平均分）
    const totalScore = (
      validatedData.quality +
      validatedData.efficiency +
      validatedData.attitude +
      validatedData.skill +
      validatedData.teamwork
    ) / 5

    // 检查是否已存在该期间的绩效
    const existing = await prisma.performanceReview.findFirst({
      where: {
        userId,
        period: validatedData.period,
      },
    })

    if (existing) {
      return { error: '该期间的绩效已填写' }
    }

    await prisma.performanceReview.create({
      data: {
        userId,
        period: validatedData.period,
        quality: validatedData.quality,
        efficiency: validatedData.efficiency,
        attitude: validatedData.attitude,
        skill: validatedData.skill,
        teamwork: validatedData.teamwork,
        totalScore,
        comment: validatedData.comment,
        reviewerId: reviewerId || null,
      },
    })

    revalidatePath('/dashboard/performance')
    return { success: '绩效已提交' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '提交失败，请稍后重试' }
  }
}

export async function getPerformanceReviews(userId?: string, role?: string) {
  try {
    const where: any = {}
    
    if (role === 'EMPLOYEE' && userId) {
      where.userId = userId
    }

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

    return reviews.map(review => ({
      ...review,
      userName: review.user.name,
      reviewerName: review.reviewer?.name || null,
    }))
  } catch (error) {
    console.error('获取绩效记录失败:', error)
    return []
  }
}
