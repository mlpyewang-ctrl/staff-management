import { describe, expect, it } from 'vitest'
import { calculateLeaveDaysExcludingNonWorkingDays } from '../utils'

describe('calculateLeaveDaysExcludingNonWorkingDays', () => {
  it('should count same-day morning to afternoon as one day', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-03-18'), new Date('2026-03-18'), {
      startSession: 'AM',
      endSession: 'PM',
    })
    expect(days).toBe(1)
  })

  it('should count same-day half-day requests as half day', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-03-18'), new Date('2026-03-18'), {
      startSession: 'AM',
      endSession: 'AM',
    })
    expect(days).toBe(0.5)
  })

  it('should count afternoon to morning across dates as one day', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-03-18'), new Date('2026-03-19'), {
      startSession: 'PM',
      endSession: 'AM',
    })
    expect(days).toBe(1)
  })

  it('should exclude weekends', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-03-20'), new Date('2026-03-23'), {
      startSession: 'AM',
      endSession: 'PM',
    })
    expect(days).toBe(2)
  })

  it('should exclude legal holidays but include compensatory workdays', () => {
    const days = calculateLeaveDaysExcludingNonWorkingDays(new Date('2026-05-01'), new Date('2026-05-04'), {
      legalHolidayDates: ['2026-05-01'],
      compensatoryWorkDates: ['2026-05-02'],
      startSession: 'AM',
      endSession: 'PM',
    })

    expect(days).toBe(2)
  })
})
