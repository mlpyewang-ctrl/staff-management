'use server'

import { prisma } from '@/lib/prisma'
import { APPLICATION_TYPES, ApplicationType } from '@/lib/approval-constants'

export async function getApprovalFlows() {
  return prisma.approvalFlow.findMany({
    include: {
      department: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

function parseApplicableUserIds(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveApprovalFlow(formData: FormData) {
  try {
    const id = (formData.get('id') as string) || ''
    const departmentId = (formData.get('departmentId') as string) || ''
    const name = (formData.get('name') as string) || ''
    const typesStr = (formData.get('types') as string) || ''
    const configStr = (formData.get('config') as string) || ''
    const applicableUserIdsStr = (formData.get('applicableUserIds') as string) || ''

    if (!departmentId || !name) {
      return { error: '部门和流程名称不能为空' }
    }

    // 解析并验证类型
    let types: string[] = []
    if (typesStr) {
      try {
        types = JSON.parse(typesStr)
      } catch {
        return { error: '类型配置必须是合法的 JSON' }
      }
      if (!Array.isArray(types)) {
        return { error: '类型必须是数组格式' }
      }
      // 验证类型值是否有效
      const invalidTypes = types.filter(t => !APPLICATION_TYPES.includes(t as ApplicationType))
      if (invalidTypes.length > 0) {
        return { error: `无效的类型: ${invalidTypes.join(', ')}` }
      }
    }

    // 简单校验 JSON 配置
    let parsedConfig: unknown = {}
    if (configStr) {
      try {
        parsedConfig = JSON.parse(configStr)
      } catch {
        return { error: '审批配置必须是合法的 JSON' }
      }
    }

    // 解析绑定用户
    let applicableUserIds: string[] = []
    if (applicableUserIdsStr) {
      try {
        applicableUserIds = JSON.parse(applicableUserIdsStr)
      } catch {
        return { error: '绑定人员配置必须是合法的 JSON 数组' }
      }
      if (!Array.isArray(applicableUserIds)) {
        return { error: '绑定人员必须是数组格式' }
      }
    }

    // 校验：必须绑定至少一个人员
    if (applicableUserIds.length === 0) {
      return { error: '请至少绑定一名人员' }
    }

    // 校验：同部门同类型下，一个用户不能被同时绑定到多条流程
    const existingFlows = await prisma.approvalFlow.findMany({
      where: {
        departmentId,
        isActive: true,
        id: id ? { not: id } : undefined,
      },
    })

    if (applicableUserIds.length > 0) {
      const conflictUsers: string[] = []
      for (const flow of existingFlows) {
        let existingTypes: string[] = []
        try {
          existingTypes = JSON.parse(flow.types)
        } catch {
          continue
        }
        const hasTypeOverlap = types.some(t => existingTypes.includes(t))
        if (!hasTypeOverlap) continue

        const boundUsers = parseApplicableUserIds(flow.applicableUserIds)
        const overlapping = applicableUserIds.filter(uid => boundUsers.includes(uid))
        if (overlapping.length > 0) {
          conflictUsers.push(...overlapping)
        }
      }

      if (conflictUsers.length > 0) {
        const uniqueConflictUsers = Array.from(new Set(conflictUsers))
        return { error: `部分人员已被其他流程绑定: ${uniqueConflictUsers.join(', ')}` }
      }
    }

    const data = {
      departmentId,
      name,
      types: JSON.stringify(types),
      config: JSON.stringify(parsedConfig),
      applicableUserIds: applicableUserIds.length > 0 ? JSON.stringify(applicableUserIds) : null,
      isActive: true,
    }

    const flow = id
      ? await prisma.approvalFlow.update({
          where: { id },
          data,
        })
      : await prisma.approvalFlow.create({
          data,
        })

    return { success: '审批流程已保存', flow }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '保存审批流程失败，请稍后重试' }
  }
}

export async function deleteApprovalFlow(id: string) {
  try {
    if (!id) {
      return { error: '缺少流程 ID' }
    }
    await prisma.approvalFlow.delete({
      where: { id },
    })
    return { success: '审批流程已删除' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '删除审批流程失败' }
  }
}
