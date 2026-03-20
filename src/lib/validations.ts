import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
})

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
  name: z.string().min(2, '姓名至少需要 2 个字符'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional().default('EMPLOYEE'),
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
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'MARRIAGE', 'MATERNITY', 'PATERNITY', 'COMPENSATORY']),
  startDate: z.string(),
  endDate: z.string(),
  destination: z.string().optional(),
  reason: z.string().min(10, '请详细描述请假事由（至少 10 个字符）'),
})

export const performanceSchema = z.object({
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
  idCard: optionalText,
  phone: optionalText,
  startDate: optionalText,
})

export const userJobAssignmentSchema = z.object({
  departmentId: optionalText,
  positionId: optionalText,
  level: optionalText.refine(
    (value) => value === undefined || value.length <= 50,
    '职级不能超过 50 个字符'
  ),
})

export const positionSchema = z.object({
  name: z.string().min(2, '岗位名称至少需要 2 个字符'),
  salary: z
    .string()
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, '请输入有效的薪资金额'),
  level: z.string().optional(),
})

export const salaryGenerateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '请选择有效的月份'),
  departmentId: z.string().optional(),
})

export const salaryStatusSchema = z.object({
  salaryId: z.string(),
  status: z.enum(['CONFIRMED', 'PAID']),
})

export const compensatoryUseSchema = z.object({
  hours: z.enum(['4', '8']),
  startDate: z.string(),
  reason: z.string().min(10, '请详细描述调休事由（至少 10 个字符）'),
})

export const holidaySchema = z.object({
  name: z.string().min(2, '节假日名称至少需要 2 个字符'),
  date: z.string(),
  type: z.enum(['LEGAL_HOLIDAY', 'COMPENSATORY']),
})
