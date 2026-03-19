import { describe, expect, it } from 'vitest'
import { calculateLeaveDaysExcludingNonWorkingDays } from '../utils'

describe('calculateLeaveDaysExcludingNonWorkingDays', () => {
  it('should count a single working day as half day', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-03-18'), new Date('2026-03-18'))
    expect(days).toBe(0.5)
  })

  it('should exclude weekends', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-03-20'), new Date('2026-03-23'))
    expect(days).toBe(2)
  })

  it('should exclude legal holidays but include compensatory workdays', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-05-01'), new Date('2026-05-04'), {
      legalHolidayDates: ['2026-05-01'],
      compensatoryWorkDates: ['2026-05-02'],
    })

    expect(days).toBe(2)
  })
})
