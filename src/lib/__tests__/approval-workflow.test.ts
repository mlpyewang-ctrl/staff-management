import { describe, expect, it } from 'vitest'
import {
  canApproveCurrentStep,
  normalizeApprovalFlowSteps,
  resolveApprovalWorkflowState,
} from '../approval-workflow'

describe('normalizeApprovalFlowSteps', () => {
  it('should normalize and sort configured steps', () => {
    const steps = normalizeApprovalFlowSteps([
      { step: 2, role: 'admin', name: '管理员审批' },
      { step: 1, role: 'manager', name: '部门经理审批' },
    ])

    expect(steps).toEqual([
      { step: 1, role: 'MANAGER', name: '部门经理审批' },
      { step: 2, role: 'ADMIN', name: '管理员审批' },
    ])
  })

  it('should fallback to default steps when config is invalid', () => {
    const steps = normalizeApprovalFlowSteps('{invalid json}')

    expect(steps).toHaveLength(2)
    expect(steps[0].role).toBe('MANAGER')
    expect(steps[1].role).toBe('ADMIN')
  })
})

describe('resolveApprovalWorkflowState', () => {
  const steps = normalizeApprovalFlowSteps([
    { step: 1, role: 'MANAGER', name: '部门经理审批' },
    { step: 2, role: 'ADMIN', name: '管理员审批' },
  ])

  it('should point to the next step after approval', () => {
    const state = resolveApprovalWorkflowState({
      steps,
      approvals: [{ status: 'APPROVED' }],
      applicationStatus: 'PENDING',
    })

    expect(state.currentStepIndex).toBe(1)
    expect(state.currentStep?.role).toBe('ADMIN')
    expect(state.completedSteps).toBe(1)
  })

  it('should return to applicant when draft is restored', () => {
    const state = resolveApprovalWorkflowState({
      steps,
      approvals: [{ status: 'REJECTED' }],
      applicationStatus: 'DRAFT',
    })

    expect(state.isReturnedToApplicant).toBe(true)
    expect(state.currentStepIndex).toBe(0)
    expect(state.currentStep?.role).toBe('MANAGER')
  })

  it('should return to previous approval step after a later rejection', () => {
    const state = resolveApprovalWorkflowState({
      steps,
      approvals: [{ status: 'APPROVED' }, { status: 'REJECTED' }],
      applicationStatus: 'PENDING',
    })

    expect(state.currentStepIndex).toBe(0)
    expect(state.currentStep?.role).toBe('MANAGER')
  })

  it('should mark final approved applications as completed', () => {
    const state = resolveApprovalWorkflowState({
      steps,
      approvals: [{ status: 'APPROVED' }, { status: 'APPROVED' }],
      applicationStatus: 'COMPLETED',
    })

    expect(state.isCompleted).toBe(true)
    expect(state.currentStep).toBeNull()
    expect(state.completedSteps).toBe(2)
  })
})

describe('canApproveCurrentStep', () => {
  const steps = normalizeApprovalFlowSteps([
    { step: 1, role: 'MANAGER', name: '部门经理审批' },
    { step: 2, role: 'ADMIN', name: '管理员审批' },
  ])

  it('should allow the matching manager in the same department', () => {
    expect(
      canApproveCurrentStep({
        currentStep: steps[0],
        approverRole: 'MANAGER',
        approverDepartmentId: 'dept-1',
        applicantDepartmentId: 'dept-1',
      })
    ).toBe(true)
  })

  it('should reject managers from other departments', () => {
    expect(
      canApproveCurrentStep({
        currentStep: steps[0],
        approverRole: 'MANAGER',
        approverDepartmentId: 'dept-2',
        applicantDepartmentId: 'dept-1',
      })
    ).toBe(false)
  })
})
