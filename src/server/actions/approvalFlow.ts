'use server'

import { prisma } from '@/lib/prisma'
import { APPLICATION_TYPES, APPLICATION_TYPE_LABELS, ApplicationType } from '@/lib/approval-constants'

export async function getApprovalFlows() {
  return prisma.approvalFlow.findMany({
    include: {
      department: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function saveApprovalFlow(formData: FormData) {
  try {
    const id = (formData.get('id') as string) || ''
    const departmentId = (formData.get('departmentId') as string) || ''
    const name = (formData.get('name') as string) || ''
    const typesStr = (formData.get('types') as string) || ''
    const configStr = (formData.get('config') as string) || ''

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
    let parsedConfig: any = {}
    if (configStr) {
      try {
        parsedConfig = JSON.parse(configStr)
      } catch {
        return { error: '审批配置必须是合法的 JSON' }
      }
    }

    // 唯一性校验：同一部门下，同一类型不能出现在多个流程中
    const existingFlows = await prisma.approvalFlow.findMany({
      where: {
        departmentId,
        id: id ? { not: id } : undefined,
      },
    })

    const conflictTypes: string[] = []
    for (const flow of existingFlows) {
      let existingTypes: string[] = []
      try {
        existingTypes = JSON.parse(flow.types)
      } catch {
        continue
      }
      const overlapping = types.filter(t => existingTypes.includes(t))
      if (overlapping.length > 0) {
        conflictTypes.push(...overlapping)
      }
    }

    if (conflictTypes.length > 0) {
      const conflictLabels = [...new Set(conflictTypes)].map(
        t => APPLICATION_TYPE_LABELS[t as ApplicationType] || t
      )
      return { error: `该部门已存在 ${conflictLabels.join('、')} 的审批流程` }
    }

    const data = {
      departmentId,
      name,
      types: JSON.stringify(types),
      config: JSON.stringify(parsedConfig),
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
