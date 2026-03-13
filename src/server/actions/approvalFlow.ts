'use server'

import { prisma } from '@/lib/prisma'

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
    const configStr = (formData.get('config') as string) || ''

    if (!departmentId || !name) {
      return { error: '部门和流程名称不能为空' }
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

    const data = {
      departmentId,
      name,
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

