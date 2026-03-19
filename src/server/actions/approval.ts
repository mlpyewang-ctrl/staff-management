'use server'

import { prisma } from '@/lib/prisma'
import { approvalSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import {
  canApproveCurrentStep,
  getDefaultApprovalFlowSteps,
  normalizeApprovalFlowSteps,
  resolveApprovalWorkflowState,
  type ApprovalFlowStep,
} from '@/lib/approval-workflow'

type SupportedApplicationType = 'OVERTIME' | 'LEAVE'

function parseFlowTypes(types: string) {
  try {
    const parsed = JSON.parse(types)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getApprovalSteps(departmentId: string | null | undefined, applicationType: SupportedApplicationType) {
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

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPENSATORY: '调休',
}

export async function approveApplication(formData: FormData) {
  try {
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

    const approver = await prisma.user.findUnique({
      where: { id: approverId },
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
      const overtimeApp = await prisma.overtimeApplication.findUnique({
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

      if (!overtimeApp) {
        return { error: '加班申请不存在' }
      }

      if (['COMPLETED', 'APPROVED'].includes(overtimeApp.status)) {
        return { error: '该申请已完成审批' }
      }

      if (overtimeApp.status === 'DRAFT') {
        return { error: '该申请已退回申请人，请等待申请人修改后重新提交' }
      }

      const steps = await getApprovalSteps(overtimeApp.user.departmentId, 'OVERTIME')
      const approvals = await prisma.approval.findMany({
        where: {
          applicationId: overtimeApp.id,
          applicationType: 'OVERTIME',
        },
        orderBy: {
          createdAt: 'asc',
        },
      })
      const normalizedApprovals = approvals
        .filter((approval) => approval.status === 'APPROVED' || approval.status === 'REJECTED')
        .map((approval) => ({ status: approval.status as 'APPROVED' | 'REJECTED' }))

      const workflow = resolveApprovalWorkflowState({
        steps,
        approvals: normalizedApprovals,
        applicationStatus: overtimeApp.status,
      })

      if (workflow.isCompleted || !workflow.currentStep || workflow.currentStepIndex === null) {
        return { error: '该申请已完成审批' }
      }

      if (
        !canApproveCurrentStep({
          currentStep: workflow.currentStep,
          approverRole: approver.role,
          approverDepartmentId: approver.departmentId,
          applicantDepartmentId: overtimeApp.user.departmentId,
        })
      ) {
        return { error: `当前待 ${getCurrentStepLabel(workflow.currentStep)} 处理` }
      }

      await prisma.approval.create({
        data: {
          applicationId: overtimeApp.id,
          applicationType: 'OVERTIME',
          applicantId: overtimeApp.userId,
          approverId,
          status: validatedData.status,
          remark: validatedData.remark,
        },
      })

      if (validatedData.status === 'APPROVED') {
        const isFinalStep = workflow.currentStepIndex === steps.length - 1

        await prisma.overtimeApplication.update({
          where: { id: overtimeApp.id },
          data: {
            status: isFinalStep ? 'COMPLETED' : 'PENDING',
            approverId,
            approvedAt: isFinalStep ? now : null,
            remark: validatedData.remark || null,
          },
        })

        revalidatePath('/dashboard/approvals')
        revalidatePath('/dashboard/overtime')

        if (isFinalStep) {
          return { success: '审批完成，状态已置为完成' }
        }

        return { success: `审批已通过，流转至 ${getCurrentStepLabel(steps[workflow.currentStepIndex + 1])}` }
      }

      const shouldReturnToApplicant = workflow.currentStepIndex === 0

      await prisma.overtimeApplication.update({
        where: { id: overtimeApp.id },
        data: {
          status: shouldReturnToApplicant ? 'DRAFT' : 'PENDING',
          approverId,
          approvedAt: null,
          remark: validatedData.remark || null,
        },
      })

      revalidatePath('/dashboard/approvals')
      revalidatePath('/dashboard/overtime')

      if (shouldReturnToApplicant) {
        return { success: '已退回申请人，申请人可修改后重新提交' }
      }

      return { success: `已退回 ${getCurrentStepLabel(steps[workflow.currentStepIndex - 1])}` }
    }

    const leaveApp = await prisma.leaveApplication.findUnique({
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

    if (!leaveApp) {
      return { error: '请假申请不存在' }
    }

    if (['COMPLETED', 'APPROVED'].includes(leaveApp.status)) {
      return { error: '该申请已完成审批' }
    }

    if (leaveApp.status === 'DRAFT') {
      return { error: '该申请已退回申请人，请等待申请人修改后重新提交' }
    }

    const steps = await getApprovalSteps(leaveApp.user.departmentId, 'LEAVE')
    const approvals = await prisma.approval.findMany({
      where: {
        applicationId: leaveApp.id,
        applicationType: 'LEAVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
    const normalizedApprovals = approvals
      .filter((approval) => approval.status === 'APPROVED' || approval.status === 'REJECTED')
      .map((approval) => ({ status: approval.status as 'APPROVED' | 'REJECTED' }))

    const workflow = resolveApprovalWorkflowState({
      steps,
      approvals: normalizedApprovals,
      applicationStatus: leaveApp.status,
    })

    if (workflow.isCompleted || !workflow.currentStep || workflow.currentStepIndex === null) {
      return { error: '该申请已完成审批' }
    }

    if (
      !canApproveCurrentStep({
        currentStep: workflow.currentStep,
        approverRole: approver.role,
        approverDepartmentId: approver.departmentId,
        applicantDepartmentId: leaveApp.user.departmentId,
      })
    ) {
      return { error: `当前待 ${getCurrentStepLabel(workflow.currentStep)} 处理` }
    }

    await prisma.approval.create({
      data: {
        applicationId: leaveApp.id,
        applicationType: 'LEAVE',
        applicantId: leaveApp.userId,
        approverId,
        status: validatedData.status,
        remark: validatedData.remark,
      },
    })

    if (validatedData.status === 'APPROVED') {
      const isFinalStep = workflow.currentStepIndex === steps.length - 1

      await prisma.leaveApplication.update({
        where: { id: leaveApp.id },
        data: {
          status: isFinalStep ? 'COMPLETED' : 'PENDING',
          approverId,
          approvedAt: isFinalStep ? now : null,
          remark: validatedData.remark || null,
        },
      })

      if (isFinalStep) {
        const balance = await prisma.leaveBalance.findFirst({
          where: {
            userId: leaveApp.userId,
            year: now.getFullYear(),
          },
        })

        if (balance && ['ANNUAL', 'SICK', 'PERSONAL', 'COMPENSATORY'].includes(leaveApp.type)) {
          const updateData: Record<string, { decrement: number } | { increment: number }> = {}

          if (leaveApp.type === 'ANNUAL') {
            updateData.annual = { decrement: leaveApp.days }
          } else if (leaveApp.type === 'SICK') {
            updateData.sick = { decrement: leaveApp.days }
          } else if (leaveApp.type === 'PERSONAL') {
            updateData.personal = { decrement: leaveApp.days }
          } else if (leaveApp.type === 'COMPENSATORY') {
            updateData.usedCompensatory = { increment: leaveApp.days * 8 }
          }

          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: updateData,
          })
        }
      }

      revalidatePath('/dashboard/approvals')
      revalidatePath('/dashboard/leave')
      revalidatePath('/dashboard/compensatory')

      if (isFinalStep) {
        return { success: '审批完成，状态已置为完成' }
      }

      return { success: `审批已通过，流转至 ${getCurrentStepLabel(steps[workflow.currentStepIndex + 1])}` }
    }

    const shouldReturnToApplicant = workflow.currentStepIndex === 0

    await prisma.leaveApplication.update({
      where: { id: leaveApp.id },
      data: {
        status: shouldReturnToApplicant ? 'DRAFT' : 'PENDING',
        approverId,
        approvedAt: null,
        remark: validatedData.remark || null,
      },
    })

    revalidatePath('/dashboard/approvals')
    revalidatePath('/dashboard/leave')
    revalidatePath('/dashboard/compensatory')

    if (shouldReturnToApplicant) {
      return { success: '已退回申请人，申请人可修改后重新提交' }
    }

    return { success: `已退回 ${getCurrentStepLabel(steps[workflow.currentStepIndex - 1])}` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '审批失败，请稍后重试' }
  }
}

export async function getPendingApprovals(approverId?: string) {
  try {
    if (!approverId) {
      return { overtime: [], leave: [] }
    }

    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: {
        id: true,
        role: true,
        departmentId: true,
      },
    })

    if (!approver || approver.role === 'EMPLOYEE') {
      return { overtime: [], leave: [] }
    }

    const [overtimeApps, leaveApps, flows, approvalHistory] = await Promise.all([
      prisma.overtimeApplication.findMany({
        where: { status: 'PENDING' },
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
        where: { status: 'PENDING' },
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
        where: {
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      prisma.approval.findMany({
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ])

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

    const overtime = overtimeApps
      .map((app) => {
        const steps =
          flowStepMap.get(`${app.user.departmentId}:${'OVERTIME'}`) || getDefaultApprovalFlowSteps()
        const history = approvalHistoryMap.get(`OVERTIME:${app.id}`) || []
        const normalizedHistory = history
          .filter((approval) => approval.status === 'APPROVED' || approval.status === 'REJECTED')
          .map((approval) => ({ status: approval.status as 'APPROVED' | 'REJECTED' }))
        const workflow = resolveApprovalWorkflowState({
          steps,
          approvals: normalizedHistory,
          applicationStatus: app.status,
        })

        if (
          !workflow.currentStep ||
          workflow.currentStepIndex === null ||
          !canApproveCurrentStep({
            currentStep: workflow.currentStep,
            approverRole: approver.role,
            approverDepartmentId: approver.departmentId,
            applicantDepartmentId: app.user.departmentId,
          })
        ) {
          return null
        }

        return {
          ...app,
          userName: app.user.name,
          departmentName: app.user.department?.name,
          currentStepName: getCurrentStepLabel(workflow.currentStep),
          currentStepRole: workflow.currentStep.role,
          approvalProgress: buildProgressText(workflow.completedSteps, workflow.totalSteps),
        }
      })
      .filter(Boolean)

    const leave = leaveApps
      .map((app) => {
        const steps = flowStepMap.get(`${app.user.departmentId}:${'LEAVE'}`) || getDefaultApprovalFlowSteps()
        const history = approvalHistoryMap.get(`LEAVE:${app.id}`) || []
        const normalizedHistory = history
          .filter((approval) => approval.status === 'APPROVED' || approval.status === 'REJECTED')
          .map((approval) => ({ status: approval.status as 'APPROVED' | 'REJECTED' }))
        const workflow = resolveApprovalWorkflowState({
          steps,
          approvals: normalizedHistory,
          applicationStatus: app.status,
        })

        if (
          !workflow.currentStep ||
          workflow.currentStepIndex === null ||
          !canApproveCurrentStep({
            currentStep: workflow.currentStep,
            approverRole: approver.role,
            approverDepartmentId: approver.departmentId,
            applicantDepartmentId: app.user.departmentId,
          })
        ) {
          return null
        }

        return {
          ...app,
          userName: app.user.name,
          departmentName: app.user.department?.name,
          leaveTypeText: leaveTypeMap[app.type] || app.type,
          currentStepName: getCurrentStepLabel(workflow.currentStep),
          currentStepRole: workflow.currentStep.role,
          approvalProgress: buildProgressText(workflow.completedSteps, workflow.totalSteps),
        }
      })
      .filter(Boolean)

    return {
      overtime,
      leave,
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
