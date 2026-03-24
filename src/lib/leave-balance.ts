import { prisma } from '@/lib/prisma'
import { calculateAnnualLeaveEntitlement } from '@/lib/seniority'

const DEFAULT_ANNUAL_LEAVE_DAYS = 5
const DEFAULT_SICK_LEAVE_DAYS = 10
const DEFAULT_PERSONAL_LEAVE_DAYS = 5

type LeaveBalanceDbClient = Pick<typeof prisma, 'user' | 'leaveBalance'>

async function getAnnualLeaveEntitlement(client: LeaveBalanceDbClient, userId: string) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      seniorityStartDate: true,
      seniorityEndDate: true,
    },
  })

  if (!user) {
    return DEFAULT_ANNUAL_LEAVE_DAYS
  }

  return calculateAnnualLeaveEntitlement(user.seniorityStartDate, user.seniorityEndDate)
}

export async function ensureLeaveBalance(userId: string, client: LeaveBalanceDbClient = prisma) {
  const currentYear = new Date().getFullYear()
  const annualEntitlement = await getAnnualLeaveEntitlement(client, userId)

  const existingBalance = await client.leaveBalance.findUnique({
    where: { userId },
  })

  if (!existingBalance) {
    return client.leaveBalance.create({
      data: {
        userId,
        year: currentYear,
        annual: annualEntitlement,
        annualEntitlement,
        sick: DEFAULT_SICK_LEAVE_DAYS,
        personal: DEFAULT_PERSONAL_LEAVE_DAYS,
        compensatory: 0,
        usedCompensatory: 0,
      },
    })
  }

  if (existingBalance.year !== currentYear) {
    return client.leaveBalance.update({
      where: { userId },
      data: {
        year: currentYear,
        annual: annualEntitlement,
        annualEntitlement,
        sick: DEFAULT_SICK_LEAVE_DAYS,
        personal: DEFAULT_PERSONAL_LEAVE_DAYS,
      },
    })
  }

  const currentEntitlement = existingBalance.annualEntitlement ?? DEFAULT_ANNUAL_LEAVE_DAYS
  if (currentEntitlement !== annualEntitlement) {
    const nextAnnual = Math.max(existingBalance.annual + annualEntitlement - currentEntitlement, 0)

    return client.leaveBalance.update({
      where: { userId },
      data: {
        annual: nextAnnual,
        annualEntitlement,
      },
    })
  }

  return existingBalance
}
