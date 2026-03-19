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
  companyId: z.string().nullish(),
})

export const overtimeSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  type: z.enum(['WORKDAY', 'WEEKEND', 'HOLIDAY']),
  reason: z.string().min(10, '请详细描述加班事由（至少 10 个字符）'),
})

export const leaveSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'MARRIAGE', 'MATERNITY', 'PATERNITY']),
  startDate: z.string(),
  endDate: z.string(),
  destination: z.string().optional(),
  reason: z.string().min(10, '请详细描述请假事由（至少 10 个字符）'),
})

export const performanceSchema = z.object({
  // 支持 YYYY-MM 或 YYYY-Qx（季度）
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/, '格式为 YYYY-MM 或 YYYY-Qx'),
  quality: z.number().min(1).max(5),
  efficiency: z.number().min(1).max(5),
  attitude: z.number().min(1).max(5),
  skill: z.number().min(1).max(5),
  teamwork: z.number().min(1).max(5),
  comment: z.string().optional(),
  selfComment: z.string().optional(),
})

export const approvalSchema = z.object({
  applicationId: z.string(),
  applicationType: z.enum(['OVERTIME', 'LEAVE']),
  status: z.enum(['APPROVED', 'REJECTED']),
  remark: z.string().optional(),
})

export const userProfileSchema = z.object({
  name: z.string().min(2, '姓名至少需要 2 个字符'),
  idCard: z.string().optional(),
  phone: z.string().optional(),
  salary: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || !Number.isNaN(v), '薪资必须是数字'),
  level: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  startDate: z.string().optional(),
})

export const positionSchema = z.object({
  name: z.string().min(2, '岗位名称至少需要 2 个字符'),
  salary: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, '请输入有效的薪资数额'),
  level: z.string().optional(),
})

// ========== 新增：薪资和调休相关验证规则 ==========

export const salaryGenerateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '请选择有效的月份'),
  departmentId: z.string().optional(),
})

export const salaryStatusSchema = z.object({
  salaryId: z.string(),
  status: z.enum(['CONFIRMED', 'PAID']),
})

export const compensatoryUseSchema = z.object({
  hours: z.enum(['4', '8']), // 半天4h 或 一天8h
  startDate: z.string(),
  reason: z.string().min(10, '请详细描述调休事由（至少 10 个字符）'),
})

export const holidaySchema = z.object({
  name: z.string().min(2, '节假日名称至少需要 2 个字符'),
  date: z.string(),
  type: z.enum(['LEGAL_HOLIDAY', 'COMPENSATORY']),
})
