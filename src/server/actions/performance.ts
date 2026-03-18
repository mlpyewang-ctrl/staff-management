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
      selfComment: formData.get('selfComment'),
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

    const action = (formData.get('action') as string) === 'submit' ? 'submit' : 'save'

    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '00641c',
      },
      body: JSON.stringify({
        sessionId: '00641c',
        runId: 'pre-fix',
        hypothesisId: 'S3',
        location: 'src/server/actions/performance.ts:createPerformanceReview',
        message: 'Create performance',
        data: {
          action,
          userIdPresent: !!userId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    const created = await prisma.performanceReview.create({
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
        selfComment: validatedData.selfComment,
        reviewerId: reviewerId || null,
        status: action === 'submit' ? 'PENDING' : 'DRAFT',
      },
    })

    revalidatePath('/dashboard/performance')
    return {
      success: action === 'submit' ? '绩效已提交' : '绩效草稿已保存',
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
    const id = formData.get('id') as string
    if (!id) {
      return { error: '缺少绩效记录 ID' }
    }

    const validatedData = performanceSchema.parse({
      period: formData.get('period'),
      quality: parseInt(formData.get('quality') as string),
      efficiency: parseInt(formData.get('efficiency') as string),
      attitude: parseInt(formData.get('attitude') as string),
      skill: parseInt(formData.get('skill') as string),
      teamwork: parseInt(formData.get('teamwork') as string),
      comment: formData.get('comment'),
      selfComment: formData.get('selfComment'),
    })

    const totalScore = (
      validatedData.quality +
      validatedData.efficiency +
      validatedData.attitude +
      validatedData.skill +
      validatedData.teamwork
    ) / 5

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
        status: (formData.get('action') as string) === 'submit' ? 'PENDING' : undefined,
      },
    })

    revalidatePath('/dashboard/performance')
    return { success: (formData.get('action') as string) === 'submit' ? '绩效已提交' : '绩效已保存' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

export async function deletePerformanceReview(id: string) {
  try {
    if (!id) return { error: '缺少绩效记录 ID' }
    await prisma.performanceReview.delete({ where: { id } })
    revalidatePath('/dashboard/performance')
    return { success: '绩效记录已删除' }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: '删除失败，请稍后重试' }
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

export async function getPerformanceReview(id: string) {
  try {
    const review = await prisma.performanceReview.findUnique({ where: { id } })
    return review
  } catch (error) {
    console.error('获取绩效详情失败:', error)
    return null
  }
}
