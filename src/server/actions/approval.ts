'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import {
  canApproveCurrentStep,
  getDefaultApprovalFlowSteps,
  normalizeApprovalFlowSteps,
  resolveApprovalWorkflowState,
  type ApprovalFlowStep,
} from '@/lib/approval-workflow'
import { requireManagerUser } from '@/lib/action-auth'
import { prisma } from '@/lib/prisma'
import { approvalSchema } from '@/lib/validations'

type SupportedApplicationType = 'OVERTIME' | 'LEAVE'

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPENSATORY: '调休',
}

function parseFlowTypes(types: string) {
  try {
    const parsed = JSON.parse(types)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getApprovalSteps(
  departmentId: string | null | undefined,
  applicationType: SupportedApplicationType
) {
  if (!departmentId) {
    return getDefaultApprovalFlowSteps()
  }

  const flows = await prisma.approvalFlow.findMany({
    where: {
      departmentId,
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  const matchedFlow = flows.find((flow) => parseFlowTypes(flow.types).includes(applicationType))

  if (!matchedFlow) {
    return getDefaultApprovalFlowSteps()
  }

  return normalizeApprovalFlowSteps(matchedFlow.config)
}

function getCurrentStepLabel(step: ApprovalFlowStep | null) {
  return step?.name || '当前审批节点'
}

function buildProgressText(completedSteps: number, totalSteps: number) {
  return `${completedSteps}/${totalSteps}`
}

function normalizeApprovalStatuses(
  approvals: Array<{
    status: string
  }>
) {
  return approvals
    .filter((approval) => approval.status === 'APPROVED' || approval.status === 'REJECTED')
    .map((approval) => ({
      status: approval.status as 'APPROVED' | 'REJECTED',
    }))
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}

export async function approveApplication(formData: FormData) {
  try {
    const sessionUser = await requireManagerUser()
    const validatedData = approvalSchema.parse({
      applicationId: formData.get('applicationId'),
      applicationType: formData.get('applicationType'),
      status: formData.get('status'),
      remark: formData.get('remark'),
    })

    const approver = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
      },
    })

    if (!approver) {
      return { error: '审批人不存在' }
    }

    const now = new Date()

    if (validatedData.applicationType === 'OVERTIME') {
      const overtimeApplication = await prisma.overtimeApplication.findUnique({
        where: { id: validatedData.applicationId },
        include: {
          user: {
            select: {
              id: true,
              departmentId: true,
              name: true,
            },
          },
        },
      })

      if (!overtimeApplication) {
        return { error: '加班申请不存在' }
      }

      if (['COMPLETED', 'APPROVED'].includes(overtimeApplication.status)) {
        return { error: '该申请已完成审批' }
      }

      if (overtimeApplication.status === 'DRAFT') {
        return { error: '该申请已退回申请人，请等待申请人修改后重新提交' }
      }

      const steps = await getApprovalSteps(overtimeApplication.user.departmentId, 'OVERTIME')
      const approvals = await prisma.approval.findMany({
        where: {
          applicationId: overtimeApplication.id,
          applicationType: 'OVERTIME',
        },
        orderBy: {
          createdAt: 'asc',
        },
      })
      const workflow = resolveApprovalWorkflowState({
        steps,
        approvals: normalizeApprovalStatuses(approvals),
        applicationStatus: overtimeApplication.status,
      })

      if (workflow.isCompleted || !workflow.currentStep || workflow.currentStepIndex === null) {
        return { error: '该申请已完成审批' }
      }

      if (
        !canApproveCurrentStep({
          currentStep: workflow.currentStep,
          approverId: approver.id,
          approverRole: approver.role,
          approverDepartmentId: approver.departmentId,
          applicantDepartmentId: overtimeApplication.user.departmentId,
        })
      ) {
        return { error: `当前仅支持处理 ${getCurrentStepLabel(workflow.currentStep)}` }
      }

      if (validatedData.status === 'APPROVED') {
        const isFinalStep = workflow.currentStepIndex === steps.length - 1

        await prisma.$transaction(async (tx) => {
          await tx.approval.create({
            data: {
              applicationId: overtimeApplication.id,
              applicationType: 'OVERTIME',
              applicantId: overtimeApplication.userId,
              approverId: approver.id,
              status: validatedData.status,
              remark: validatedData.remark,
            },
          })

          await tx.overtimeApplication.update({
            where: { id: overtimeApplication.id },
            data: {
              status: isFinalStep ? 'COMPLETED' : 'PENDING',
              approverId: approver.id,
              approvedAt: isFinalStep ? now : null,
              remark: validatedData.remark || null,
            },
          })
        })

        revalidatePath('/dashboard/approvals')
        revalidatePath('/dashboard/overtime')

        if (isFinalStep) {
          return { success: '审批完成，状态已更新为已完成' }
        }

        return {
          success: `审批已通过，流转至 ${getCurrentStepLabel(steps[workflow.currentStepIndex + 1])}`,
        }
      }

      const shouldReturnToApplicant = workflow.currentStepIndex === 0

      await prisma.$transaction(async (tx) => {
        await tx.approval.create({
          data: {
            applicationId: overtimeApplication.id,
            applicationType: 'OVERTIME',
            applicantId: overtimeApplication.userId,
            approverId: approver.id,
            status: validatedData.status,
            remark: validatedData.remark,
          },
        })

        await tx.overtimeApplication.update({
          where: { id: overtimeApplication.id },
          data: {
            status: shouldReturnToApplicant ? 'DRAFT' : 'PENDING',
            approverId: approver.id,
            approvedAt: null,
            remark: validatedData.remark || null,
          },
        })
      })

      revalidatePath('/dashboard/approvals')
      revalidatePath('/dashboard/overtime')

      if (shouldReturnToApplicant) {
        return { success: '已退回申请人，申请人可修改后重新提交' }
      }

      return { success: `已退回至 ${getCurrentStepLabel(steps[workflow.currentStepIndex - 1])}` }
    }

    const leaveApplication = await prisma.leaveApplication.findUnique({
      where: { id: validatedData.applicationId },
      include: {
        user: {
          select: {
            id: true,
            departmentId: true,
            name: true,
          },
        },
      },
    })

    if (!leaveApplication) {
      return { error: '请假申请不存在' }
    }

    if (['COMPLETED', 'APPROVED'].includes(leaveApplication.status)) {
      return { error: '该申请已完成审批' }
    }

    if (leaveApplication.status === 'DRAFT') {
      return { error: '该申请已退回申请人，请等待申请人修改后重新提交' }
    }

    const steps = await getApprovalSteps(leaveApplication.user.departmentId, 'LEAVE')
    const approvals = await prisma.approval.findMany({
      where: {
        applicationId: leaveApplication.id,
        applicationType: 'LEAVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
    const workflow = resolveApprovalWorkflowState({
      steps,
      approvals: normalizeApprovalStatuses(approvals),
      applicationStatus: leaveApplication.status,
    })

    if (workflow.isCompleted || !workflow.currentStep || workflow.currentStepIndex === null) {
      return { error: '该申请已完成审批' }
    }

    if (
      !canApproveCurrentStep({
        currentStep: workflow.currentStep,
        approverId: approver.id,
        approverRole: approver.role,
        approverDepartmentId: approver.departmentId,
        applicantDepartmentId: leaveApplication.user.departmentId,
      })
    ) {
      return { error: `当前仅支持处理 ${getCurrentStepLabel(workflow.currentStep)}` }
    }

    if (validatedData.status === 'APPROVED') {
      const isFinalStep = workflow.currentStepIndex === steps.length - 1

      await prisma.$transaction(async (tx) => {
        await tx.approval.create({
          data: {
            applicationId: leaveApplication.id,
            applicationType: 'LEAVE',
            applicantId: leaveApplication.userId,
            approverId: approver.id,
            status: validatedData.status,
            remark: validatedData.remark,
          },
        })

        await tx.leaveApplication.update({
          where: { id: leaveApplication.id },
          data: {
            status: isFinalStep ? 'COMPLETED' : 'PENDING',
            approverId: approver.id,
            approvedAt: isFinalStep ? now : null,
            remark: validatedData.remark || null,
          },
        })

        if (isFinalStep && ['ANNUAL', 'SICK', 'PERSONAL', 'COMPENSATORY'].includes(leaveApplication.type)) {
          const balance = await tx.leaveBalance.findFirst({
            where: {
              userId: leaveApplication.userId,
              year: now.getFullYear(),
            },
          })

          if (!balance) {
            return
          }

          const updateData: Record<string, { decrement: number } | { increment: number }> = {}

          if (leaveApplication.type === 'ANNUAL') {
            updateData.annual = { decrement: leaveApplication.days }
          } else if (leaveApplication.type === 'SICK') {
            updateData.sick = { decrement: leaveApplication.days }
          } else if (leaveApplication.type === 'PERSONAL') {
            updateData.personal = { decrement: leaveApplication.days }
          } else if (leaveApplication.type === 'COMPENSATORY') {
            updateData.usedCompensatory = { increment: leaveApplication.days * 8 }
          }

          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: updateData,
          })
        }
      })

      revalidatePath('/dashboard/approvals')
      revalidatePath('/dashboard/leave')
      revalidatePath('/dashboard/compensatory')

      if (isFinalStep) {
        return { success: '审批完成，状态已更新为已完成' }
      }

      return {
        success: `审批已通过，流转至 ${getCurrentStepLabel(steps[workflow.currentStepIndex + 1])}`,
      }
    }

    const shouldReturnToApplicant = workflow.currentStepIndex === 0

    await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          applicationId: leaveApplication.id,
          applicationType: 'LEAVE',
          applicantId: leaveApplication.userId,
          approverId: approver.id,
          status: validatedData.status,
          remark: validatedData.remark,
        },
      })

      await tx.leaveApplication.update({
        where: { id: leaveApplication.id },
        data: {
          status: shouldReturnToApplicant ? 'DRAFT' : 'PENDING',
          approverId: approver.id,
          approvedAt: null,
          remark: validatedData.remark || null,
        },
      })
    })

    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/compensatory')

    if (shouldReturnToApplicant) {
      return { success: '已退回申请人，申请人可修改后重新提交' }
    }

    return { success: `已退回至 ${getCurrentStepLabel(steps[workflow.currentStepIndex - 1])}` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '审批失败，请稍后重试' }
  }
}

export async function getPendingApprovals(_approverId?: string) {
  try {
    const sessionUser = await requireManagerUser()
    const approver = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
      },
    })

    if (!approver || approver.role === 'EMPLOYEE') {
      return { overtime: [], leave: [] }
    }

    const overtimeWhere: Prisma.OvertimeApplicationWhereInput =
      approver.role === 'MANAGER' && approver.departmentId
        ? {
            status: 'PENDING',
            user: {
              departmentId: approver.departmentId,
            },
          }
        : {
            status: 'PENDING',
          }
    const leaveWhere: Prisma.LeaveApplicationWhereInput =
      approver.role === 'MANAGER' && approver.departmentId
        ? {
            status: 'PENDING',
            user: {
              departmentId: approver.departmentId,
            },
          }
        : {
            status: 'PENDING',
          }
    const flowWhere: Prisma.ApprovalFlowWhereInput =
      approver.role === 'MANAGER' && approver.departmentId
        ? {
            isActive: true,
            departmentId: approver.departmentId,
          }
        : {
            isActive: true,
          }

    const [overtimeApplications, leaveApplications, flows] = await Promise.all([
      prisma.overtimeApplication.findMany({
        where: overtimeWhere,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              departmentId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leaveApplication.findMany({
        where: leaveWhere,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              departmentId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.approvalFlow.findMany({
        where: flowWhere,
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ])

    const approvalHistoryConditions: Prisma.ApprovalWhereInput[] = []
    const overtimeIds = overtimeApplications.map((application) => application.id)
    const leaveIds = leaveApplications.map((application) => application.id)

    if (overtimeIds.length > 0) {
      approvalHistoryConditions.push({
        applicationType: 'OVERTIME',
        applicationId: {
          in: overtimeIds,
        },
      })
    }

    if (leaveIds.length > 0) {
      approvalHistoryConditions.push({
        applicationType: 'LEAVE',
        applicationId: {
          in: leaveIds,
        },
      })
    }

    const approvalHistory = approvalHistoryConditions.length
      ? await prisma.approval.findMany({
          where: {
            OR: approvalHistoryConditions,
          },
          orderBy: {
            createdAt: 'asc',
          },
        })
      : []

    const flowStepMap = new Map<string, ApprovalFlowStep[]>()
    for (const flow of flows) {
      const types = parseFlowTypes(flow.types)
      const steps = normalizeApprovalFlowSteps(flow.config)
      for (const type of types) {
        const key = `${flow.departmentId}:${type}`
        if (!flowStepMap.has(key)) {
          flowStepMap.set(key, steps)
        }
      }
    }

    const approvalHistoryMap = new Map<string, typeof approvalHistory>()
    for (const item of approvalHistory) {
      const key = `${item.applicationType}:${item.applicationId}`
      const items = approvalHistoryMap.get(key) || []
      items.push(item)
      approvalHistoryMap.set(key, items)
    }

    const overtime = overtimeApplications
      .map((application) => {
        const steps =
          flowStepMap.get(`${application.user.departmentId}:${'OVERTIME'}`) || getDefaultApprovalFlowSteps()
        const history = approvalHistoryMap.get(`OVERTIME:${application.id}`) || []
        const workflow = resolveApprovalWorkflowState({
          steps,
          approvals: normalizeApprovalStatuses(history),
          applicationStatus: application.status,
        })

        if (
          !workflow.currentStep ||
          workflow.currentStepIndex === null ||
        !canApproveCurrentStep({
          currentStep: workflow.currentStep,
          approverId: approver.id,
          approverRole: approver.role,
          approverDepartmentId: approver.departmentId,
          applicantDepartmentId: application.user.departmentId,
        })
        ) {
          return null
        }

        return {
          ...application,
          userName: application.user.name,
          departmentName: application.user.department?.name,
          currentStepName: getCurrentStepLabel(workflow.currentStep),
          currentStepRole: workflow.currentStep.role,
          approvalProgress: buildProgressText(workflow.completedSteps, workflow.totalSteps),
        }
      })
      .filter(isDefined)

    const leave = leaveApplications
      .map((application) => {
        const steps =
          flowStepMap.get(`${application.user.departmentId}:${'LEAVE'}`) || getDefaultApprovalFlowSteps()
        const history = approvalHistoryMap.get(`LEAVE:${application.id}`) || []
        const workflow = resolveApprovalWorkflowState({
          steps,
          approvals: normalizeApprovalStatuses(history),
          applicationStatus: application.status,
        })

        if (
          !workflow.currentStep ||
          workflow.currentStepIndex === null ||
        !canApproveCurrentStep({
          currentStep: workflow.currentStep,
          approverId: approver.id,
          approverRole: approver.role,
          approverDepartmentId: approver.departmentId,
          applicantDepartmentId: application.user.departmentId,
        })
        ) {
          return null
        }

        return {
          ...application,
          userName: application.user.name,
          departmentName: application.user.department?.name,
          leaveTypeText: leaveTypeMap[application.type] || application.type,
          currentStepName: getCurrentStepLabel(workflow.currentStep),
          currentStepRole: workflow.currentStep.role,
          approvalProgress: buildProgressText(workflow.completedSteps, workflow.totalSteps),
        }
      })
      .filter(isDefined)

    return {
      overtime,
      leave,
    }
  } catch (error) {
    console.error('获取待审批列表失败:', error)
    return { overtime: [], leave: [] }
  }
}

export async function getApprovalHistory(_approverId?: string) {
  try {
    const sessionUser = await requireManagerUser()
    const approvals = await prisma.approval.findMany({
      where: { approverId: sessionUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const applicantIds = Array.from(new Set(approvals.map((approval) => approval.applicantId)))
    const applicants = applicantIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: applicantIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : []

    const applicantMap = new Map(applicants.map((applicant) => [applicant.id, applicant.name]))

    return approvals.map((approval) => ({
      ...approval,
      applicantName: applicantMap.get(approval.applicantId) || approval.applicantId,
      applicationTypeText: approval.applicationType === 'OVERTIME' ? '加班' : '请假',
      statusText: approval.status === 'APPROVED' ? '通过' : '退回',
    }))
  } catch (error) {
    console.error('获取审批历史失败:', error)
    return []
  }
}
