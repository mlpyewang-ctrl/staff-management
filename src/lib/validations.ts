import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
})

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
  name: z.string().min(2, '姓名至少需要 2 个字符'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  companyId: z.string().optional(),
})

export const overtimeSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string().min(10, '请详细描述加班事由（至少 10 个字符）'),
})

export const leaveSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'MARRIAGE', 'MATERNITY', 'PATERNITY']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(10, '请详细描述请假事由（至少 10 个字符）'),
})

export const performanceSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, '格式为 YYYY-MM'),
  quality: z.number().min(1).max(5),
  efficiency: z.number().min(1).max(5),
  attitude: z.number().min(1).max(5),
  skill: z.number().min(1).max(5),
  teamwork: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export const approvalSchema = z.object({
  applicationId: z.string(),
  applicationType: z.enum(['OVERTIME', 'LEAVE']),
  status: z.enum(['APPROVED', 'REJECTED']),
  remark: z.string().optional(),
})
