export interface ApprovalFlowStep {
  step: number
  role: string
  name: string
  approverType?: 'ROLE' | 'USER'
  approverUserId?: string | null
  approverUserName?: string | null
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
  { step: 1, role: 'MANAGER', name: '部门经理审批', approverType: 'ROLE' },
  { step: 2, role: 'ADMIN', name: '管理员审批', approverType: 'ROLE' },
]

export function getDefaultApprovalFlowSteps() {
  return DEFAULT_FLOW_STEPS
}

function parseApprovalFlowConfig(config: unknown) {
  if (Array.isArray(config)) {
    return config
  }

  if (!config || typeof config !== 'object') {
    return []
  }

  const value = config as Record<string, unknown>

  if (Array.isArray(value.steps)) {
    return value.steps
  }

  if (Array.isArray(value.nodes)) {
    return value.nodes
  }

  return []
}

function getApproverDisplayName(role: string) {
  if (role === 'ADMIN') {
    return '管理员'
  }

  if (role === 'MANAGER') {
    return '部门主管'
  }

  return '员工'
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

  const rawSteps = parseApprovalFlowConfig(parsedConfig)

  if (rawSteps.length === 0) {
    return DEFAULT_FLOW_STEPS
  }

  const steps = rawSteps
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => {
      const configuredStep = typeof item.step === 'number' && Number.isFinite(item.step) ? item.step : index + 1
      const approverUserId =
        typeof item.approverUserId === 'string'
          ? item.approverUserId
          : typeof item.userId === 'string'
            ? item.userId
            : typeof item.assigneeId === 'string'
              ? item.assigneeId
              : null
      const approverUserName =
        typeof item.approverUserName === 'string'
          ? item.approverUserName
          : typeof item.userName === 'string'
            ? item.userName
            : typeof item.assigneeName === 'string'
              ? item.assigneeName
              : null
      const approverType: 'ROLE' | 'USER' =
        item.approverType === 'USER' || item.approverType === 'ROLE'
          ? item.approverType
          : approverUserId
            ? 'USER'
            : 'ROLE'
      const role =
        typeof item.role === 'string' && item.role.trim().length > 0
          ? String(item.role).toUpperCase()
          : approverType === 'USER'
            ? 'EMPLOYEE'
            : 'MANAGER'
      const generatedName =
        approverType === 'USER' && approverUserName
          ? `${approverUserName}审批`
          : `${getApproverDisplayName(role)}审批`

      return {
        step: configuredStep,
        role,
        approverType,
        name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : generatedName,
        ...(approverUserId ? { approverUserId } : {}),
        ...(approverUserName ? { approverUserName } : {}),
      }
    })
    .sort((left, right) => left.step - right.step)
    .map((item, index) => ({
      ...item,
      step: index + 1,
    }))

  return steps.length > 0 ? (steps as ApprovalFlowStep[]) : DEFAULT_FLOW_STEPS
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
  approverId?: string
  approverRole: string
  approverDepartmentId?: string | null
  applicantDepartmentId?: string | null
}) {
  const { currentStep, approverId, approverRole, approverDepartmentId, applicantDepartmentId } = params

  if (!currentStep) {
    return false
  }

  if (currentStep.approverType === 'USER') {
    return Boolean(currentStep.approverUserId && approverId === currentStep.approverUserId)
  }

  if (currentStep.role !== approverRole) {
    return false
  }

  if (approverRole === 'MANAGER' && approverDepartmentId && applicantDepartmentId) {
    return approverDepartmentId === applicantDepartmentId
  }

  return true
}
