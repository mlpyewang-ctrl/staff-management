export interface ApprovalFlowStep {
  step: number
  role: string
  name: string
}

export interface ApprovalHistoryItem {
  status: 'APPROVED' | 'REJECTED'
}

export interface ApprovalWorkflowState {
  currentStepIndex: number | null
  currentStep: ApprovalFlowStep | null
  completedSteps: number
  totalSteps: number
  isCompleted: boolean
  isReturnedToApplicant: boolean
}

const DEFAULT_FLOW_STEPS: ApprovalFlowStep[] = [
  { step: 1, role: 'MANAGER', name: '部门经理审批' },
  { step: 2, role: 'ADMIN', name: '管理员审批' },
]

export function getDefaultApprovalFlowSteps() {
  return DEFAULT_FLOW_STEPS
}

export function normalizeApprovalFlowSteps(config: string | unknown): ApprovalFlowStep[] {
  let parsedConfig = config

  if (typeof config === 'string') {
    try {
      parsedConfig = JSON.parse(config)
    } catch {
      return DEFAULT_FLOW_STEPS
    }
  }

  if (!Array.isArray(parsedConfig)) {
    return DEFAULT_FLOW_STEPS
  }

  const steps = parsedConfig
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter((item) => typeof item.role === 'string' && item.role.trim().length > 0)
    .map((item, index) => {
      const configuredStep = typeof item.step === 'number' && Number.isFinite(item.step) ? item.step : index + 1

      return {
        step: configuredStep,
        role: String(item.role).toUpperCase(),
        name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : `第 ${index + 1} 岗审批`,
      }
    })
    .sort((left, right) => left.step - right.step)
    .map((item, index) => ({
      ...item,
      step: index + 1,
    }))

  return steps.length > 0 ? steps : DEFAULT_FLOW_STEPS
}

export function resolveApprovalWorkflowState(params: {
  steps: ApprovalFlowStep[]
  approvals: ApprovalHistoryItem[]
  applicationStatus?: string | null
}): ApprovalWorkflowState {
  const steps = params.steps.length > 0 ? params.steps : DEFAULT_FLOW_STEPS
  const applicationStatus = params.applicationStatus || ''

  if (applicationStatus === 'COMPLETED' || applicationStatus === 'APPROVED') {
    return {
      currentStepIndex: null,
      currentStep: null,
      completedSteps: steps.length,
      totalSteps: steps.length,
      isCompleted: true,
      isReturnedToApplicant: false,
    }
  }

  if (applicationStatus === 'DRAFT') {
    return {
      currentStepIndex: 0,
      currentStep: steps[0] || null,
      completedSteps: 0,
      totalSteps: steps.length,
      isCompleted: false,
      isReturnedToApplicant: true,
    }
  }

  let currentStepIndex = 0

  for (const approval of params.approvals) {
    if (approval.status === 'APPROVED') {
      currentStepIndex += 1
      continue
    }

    if (approval.status === 'REJECTED') {
      currentStepIndex = Math.max(currentStepIndex - 1, 0)
    }
  }

  if (currentStepIndex >= steps.length) {
    return {
      currentStepIndex: null,
      currentStep: null,
      completedSteps: steps.length,
      totalSteps: steps.length,
      isCompleted: true,
      isReturnedToApplicant: false,
    }
  }

  return {
    currentStepIndex,
    currentStep: steps[currentStepIndex] || null,
    completedSteps: currentStepIndex,
    totalSteps: steps.length,
    isCompleted: false,
    isReturnedToApplicant: false,
  }
}

export function canApproveCurrentStep(params: {
  currentStep: ApprovalFlowStep | null
  approverRole: string
  approverDepartmentId?: string | null
  applicantDepartmentId?: string | null
}) {
  const { currentStep, approverRole, approverDepartmentId, applicantDepartmentId } = params

  if (!currentStep) {
    return false
  }

  if (currentStep.role !== approverRole) {
    return false
  }

  if (approverRole === 'MANAGER' && approverDepartmentId && applicantDepartmentId) {
    return approverDepartmentId === applicantDepartmentId
  }

  return true
}
