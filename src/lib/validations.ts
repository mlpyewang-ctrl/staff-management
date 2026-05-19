import { z } from 'zod'

import { EDUCATION_OPTIONS } from '@/lib/profile-versioning'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)

const optionalEducation = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}, z.enum(EDUCATION_OPTIONS).optional())

export const loginSchema = z.object({
  username: z.string().min(2, '账户名至少需要 2 个字符'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
})

export const registerSchema = z.object({
  username: z.string().min(2, '账户名至少需要 2 个字符'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
  name: z.string().min(2, '姓名至少需要 2 个字符'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'ATTENDANCE_CLERK']).optional().default('EMPLOYEE'),
  companyId: z.string().nullish(),
})

export const createUserSchema = z.object({
  username: z.string().min(2, '账户名至少需要 2 个字符'),
  name: z.string().min(2, '姓名至少需要 2 个字符'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'ATTENDANCE_CLERK']).optional().default('EMPLOYEE'),
})

export const overtimeSchema = z.object({
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string(),
  endTime: z.string(),
  type: z.enum(['WORKDAY', 'WEEKEND', 'HOLIDAY']).optional(),
  reason: z.string().min(1, '请填写加班事由'),
})

export const leaveSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'MARRIAGE', 'MATERNITY', 'PATERNITY', 'COMPENSATORY']),
  startSession: z.enum(['AM', 'PM']).optional(),
  endSession: z.enum(['AM', 'PM']).optional(),
  startDate: z.string(),
  endDate: z.string(),
  destination: z.string().optional(),
  reason: z.string().min(1, '请填写请假事由'),
}).superRefine((data, ctx) => {
  if (data.startDate === data.endDate && data.startSession === 'PM' && data.endSession === 'AM') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endSession'],
      message: '同一天请假的结束时段不能早于开始时段',
    })
  }
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
  applicationType: z.enum(['OVERTIME', 'LEAVE', 'RESIGNATION_HANDOVER', 'RESUME_UPDATE', 'PARTY_INFO_UPDATE']),
  status: z.enum(['APPROVED', 'REJECTED']),
  remark: z.string().optional(),
})

export const userProfileSchema = z.object({
  name: z.string().min(2, '姓名至少需要 2 个字符'),
  education: optionalEducation,
  idCard: optionalText,
  phone: optionalText,
  versionRemark: optionalText,
})

export const userJobAssignmentSchema = z.object({
  departmentId: optionalText,
  positionId: optionalText,
  startDate: optionalText,
  firstWorkDate: optionalText,
  versionRemark: optionalText,
  educationSalary: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), '请输入有效的学历工资金额'),
})

export const positionSchema = z.object({
  name: z.string().min(2, '岗位名称至少需要 2 个字符'),
  departmentId: z.string().min(1, '请选择部门'),
  baseSalary: z
    .string()
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, '请输入有效的基础工资金额'),
  hasSeniorityPay: z.enum(['true', 'false']).optional().default('true'),
  seniorityPayPerYear: z
    .string()
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, '请输入有效的工龄工资金额'),
  maxSeniorityPay: z
    .string()
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, '请输入有效的工龄工资上限金额'),
})

export const salaryGenerateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '请选择有效的月份'),
  departmentId: z.string().optional(),
})

export const salaryStatusSchema = z.object({
  salaryId: z.string(),
  status: z.enum(['CONFIRMED', 'PAID']),
})

export const salaryBatchAdjustmentSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1, '请至少选择一条记录'),
  field: z.enum([
    'otherAdjustment',
    'classLeaderAllowance',
    'dormHeadAllowance',
    'electricityAllowance',
    'supplementalPay',
    'deductionAdjustment',
  ]),
  amount: z
    .string()
    .refine((value) => value.trim().length > 0 && !Number.isNaN(Number(value)), '请输入有效的调整金额'),
  note: optionalText,
})

export const salarySingleAdjustmentSchema = z.object({
  salaryId: z.string().min(1, '缺少薪资记录 ID'),
  amount: z
    .string()
    .refine((value) => value.trim().length > 0 && !Number.isNaN(Number(value)), '请输入有效的调整金额'),
  note: optionalText,
})

export const compensatoryUseSchema = z.object({
  hours: z.enum(['4', '8']),
  startDate: z.string(),
  reason: z.string().min(10, '请详细描述调休事由（至少 10 个字符）'),
})

export const holidaySchema = z.object({
  name: z.string().min(2, '节假日名称至少需要 2 个字符'),
  date: z.string(),
  type: z.enum(['LEGAL_HOLIDAY', 'WEEKEND_HOLIDAY', 'COMPENSATORY_WORKDAY']),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少需要 6 个字符'),
  confirmPassword: z.string().min(1, '请确认新密码'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入的新密码不一致',
  path: ['confirmPassword'],
})

export const otherApplicationSchema = z.object({
  type: z.enum(['RESIGNATION_HANDOVER', 'RESUME_UPDATE', 'PARTY_INFO_UPDATE']),
  title: z.string().min(2, '标题至少需要 2 个字符'),
  content: z.string().min(10, '请详细描述申请内容（至少 10 个字符）'),
  attachments: z.string().optional(),
  versionRemark: optionalText,
})
