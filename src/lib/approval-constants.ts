// 申请类型常量
export const APPLICATION_TYPES = ['OVERTIME', 'LEAVE', 'PERFORMANCE'] as const
export type ApplicationType = typeof APPLICATION_TYPES[number]

// 类型映射（用于显示）
export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  OVERTIME: '加班',
  LEAVE: '请假',
  PERFORMANCE: '绩效',
}
