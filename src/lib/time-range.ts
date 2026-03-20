export type TimeRange = 'all' | 'last3Months' | 'last1Month'

export const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'last3Months', label: '最近三个月' },
  { value: 'last1Month', label: '最近一个月' },
]

function toDate(value: Date | string | number | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function isWithinTimeRange(
  value: Date | string | number | null | undefined,
  range: TimeRange,
  now = new Date()
) {
  const date = toDate(value)

  if (!date) {
    return false
  }

  if (range === 'all') {
    return true
  }

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setMonth(start.getMonth() - (range === 'last1Month' ? 1 : 3))

  return date >= start
}
