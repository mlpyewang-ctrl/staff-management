'use server'

import { prisma } from '@/lib/prisma'
import { approvalSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

export async function approveApplication(formData: FormData) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7d0b3e',
      },
      body: JSON.stringify({
        sessionId: '7d0b3e',
        runId: 'pre-fix',
        hypothesisId: 'H_in',
        location: 'src/server/actions/approval.ts:approveApplication',
        message: 'ApproveApplication entry',
        data: {
          applicationId: formData.get('applicationId'),
          applicationType: formData.get('applicationType'),
          status: formData.get('status'),
          remarkType: typeof formData.get('remark'),
          approverIdPresent: !!formData.get('approverId'),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    const validatedData = approvalSchema.parse({
      applicationId: formData.get('applicationId'),
      applicationType: formData.get('applicationType'),
      status: formData.get('status'),
      remark: formData.get('remark'),
    })

    const approverId = formData.get('approverId') as string
    if (!approverId) {
      return { error: '审批人信息缺失' }
    }

    const now = new Date()

    if (validatedData.applicationType === 'OVERTIME') {
      const overtimeApp = await prisma.overtimeApplication.findUnique({
        where: { id: validatedData.applicationId },
        select: { userId: true },
      })

      if (!overtimeApp) {
        return { error: '加班申请不存在' }
      }

      // #region agent log
      fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '7d0b3e',
        },
        body: JSON.stringify({
          sessionId: '7d0b3e',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'src/server/actions/approval.ts:approveApplication:OVERTIME',
          message: 'Overtime branch before update/create approval',
          data: {
            applicationId: validatedData.applicationId,
            status: validatedData.status,
            approverIdPresent: !!approverId,
            applicantIdPresent: !!overtimeApp.userId,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion

      await prisma.overtimeApplication.update({
        where: { id: validatedData.applicationId },
        data: {
          status: validatedData.status,
          approverId,
          approvedAt: now,
          remark: validatedData.remark,
        },
      })

      // 创建审批记录
      await prisma.approval.create({
        data: {
          applicationId: validatedData.applicationId,
          applicationType: 'OVERTIME',
          applicantId: overtimeApp.userId,
          approverId,
          status: validatedData.status,
          remark: validatedData.remark,
        },
      })
    } else if (validatedData.applicationType === 'LEAVE') {
      // #region agent log
      fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '7d0b3e',
        },
        body: JSON.stringify({
          sessionId: '7d0b3e',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'src/server/actions/approval.ts:approveApplication:LEAVE',
          message: 'Leave branch entry',
          data: {
            applicationId: validatedData.applicationId,
            status: validatedData.status,
            approverIdPresent: !!approverId,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion

      const leaveApp = await prisma.leaveApplication.findUnique({
        where: { id: validatedData.applicationId },
      })

      if (!leaveApp) {
        return { error: '请假申请不存在' }
      }

      await prisma.leaveApplication.update({
        where: { id: validatedData.applicationId },
        data: {
          status: validatedData.status,
          approverId,
          approvedAt: now,
          remark: validatedData.remark,
        },
      })

      // 如果通过，扣除假期余额
      if (validatedData.status === 'APPROVED') {
        const balance = await prisma.leaveBalance.findFirst({
          where: {
            userId: leaveApp.userId,
            year: now.getFullYear(),
          },
        })

        if (balance && ['ANNUAL', 'SICK', 'PERSONAL'].includes(leaveApp.type)) {
          const updateData: any = {}
          if (leaveApp.type === 'ANNUAL') {
            updateData.annual = { decrement: leaveApp.days }
          } else if (leaveApp.type === 'SICK') {
            updateData.sick = { decrement: leaveApp.days }
          } else if (leaveApp.type === 'PERSONAL') {
            updateData.personal = { decrement: leaveApp.days }
          }

          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: updateData,
          })
        }
      }

      // 创建审批记录
      await prisma.approval.create({
        data: {
          applicationId: validatedData.applicationId,
          applicationType: 'LEAVE',
          applicantId: leaveApp.userId,
          approverId,
          status: validatedData.status,
          remark: validatedData.remark,
        },
      })
    }

    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/overtime')
    revalidatePath('/dashboard/leave')
    return { success: '审批完成' }
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7d0b3e',
      },
      body: JSON.stringify({
        sessionId: '7d0b3e',
        runId: 'pre-fix',
        hypothesisId: 'H_err',
        location: 'src/server/actions/approval.ts:approveApplication:catch',
        message: 'ApproveApplication error',
        data: {
          name: (error as any)?.name,
          message: (error as any)?.message,
          code: (error as any)?.code,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '审批失败，请稍后重试' }
  }
}

export async function getPendingApprovals(role?: string) {
  try {
    if (role === 'EMPLOYEE') {
      return { overtime: [], leave: [] }
    }

    const [overtimeApps, leaveApps] = await Promise.all([
      prisma.overtimeApplication.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leaveApplication.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      overtime: overtimeApps.map(app => ({
        ...app,
        userName: app.user.name,
      })),
      leave: leaveApps.map(app => {
        const leaveTypeMap: Record<string, string> = {
          ANNUAL: '年假',
          SICK: '病假',
          PERSONAL: '事假',
          MARRIAGE: '婚假',
          MATERNITY: '产假',
          PATERNITY: '陪产假',
        }
        return {
          ...app,
          userName: app.user.name,
          leaveTypeText: leaveTypeMap[app.type],
        }
      }),
    }
  } catch (error) {
    console.error('获取待审批列表失败:', error)
    return { overtime: [], leave: [] }
  }
}

export async function getApprovalHistory(approverId?: string) {
  try {
    const approvals = await prisma.approval.findMany({
      where: approverId ? { approverId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return approvals
  } catch (error) {
    console.error('获取审批历史失败:', error)
    return []
  }
}
