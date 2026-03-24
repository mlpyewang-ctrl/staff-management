const DEFAULT_ANNUAL_LEAVE_DAYS = 5
const MAX_SENIORITY_PAY = 1000
const SENIORITY_PAY_PER_YEAR = 100

function normalizeDate(date?: Date | string | null) {
  if (!date) {
    return null
  }

  const normalized = date instanceof Date ? new Date(date) : new Date(date)
  if (Number.isNaN(normalized.getTime())) {
    return null
  }

  return new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate())
}

export function calculateCompletedYears(startDate?: Date | string | null, endDate?: Date | string | null) {
  const normalizedStartDate = normalizeDate(startDate)
  const normalizedEndDate = normalizeDate(endDate || new Date())

  if (!normalizedStartDate || !normalizedEndDate || normalizedEndDate < normalizedStartDate) {
    return 0
  }

  let years = normalizedEndDate.getFullYear() - normalizedStartDate.getFullYear()
  const endMonth = normalizedEndDate.getMonth()
  const startMonth = normalizedStartDate.getMonth()

  if (
    endMonth < startMonth ||
    (endMonth === startMonth && normalizedEndDate.getDate() < normalizedStartDate.getDate())
  ) {
    years -= 1
  }

  return Math.max(years, 0)
}

export function calculateAnnualLeaveEntitlement(
  seniorityStartDate?: Date | string | null,
  seniorityEndDate?: Date | string | null
) {
  const seniorityYears = calculateCompletedYears(seniorityStartDate, seniorityEndDate)

  if (seniorityYears >= 15) {
    return 15
  }

  if (seniorityYears >= 10) {
    return 10
  }

  return DEFAULT_ANNUAL_LEAVE_DAYS
}

export function calculateSeniorityPay(startDate?: Date | string | null, referenceDate?: Date | string | null) {
  const seniorityYears = calculateCompletedYears(startDate, referenceDate)
  return Math.min(seniorityYears * SENIORITY_PAY_PER_YEAR, MAX_SENIORITY_PAY)
}

export function formatDateInputValue(date?: Date | string | null) {
  const normalizedDate = normalizeDate(date)
  if (!normalizedDate) {
    return ''
  }

  return `${normalizedDate.getFullYear()}-${String(normalizedDate.getMonth() + 1).padStart(2, '0')}-${String(normalizedDate.getDate()).padStart(2, '0')}`
}
