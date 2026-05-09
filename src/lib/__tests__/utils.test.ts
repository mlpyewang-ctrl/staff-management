import { describe, expect, it } from 'vitest'
import {
  calculateHourlyRate,
  calculateLeaveDaysExcludingNonWorkingDays,
  calculateLeaveDaysInMonth,
  calculateOvertimeAllocation,
  calculateOvertimePay,
} from '../utils'

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

describe('calculateLeaveDaysInMonth', () => {
  // 2026-04-01 is Wednesday
  const monthStart = new Date('2026-04-01')
  const monthEnd = new Date('2026-04-30')

  it('should return full days when leave is entirely within month', () => {
    const days = calculateLeaveDaysInMonth(
      new Date('2026-04-06'), new Date('2026-04-08'),
      'AM', 'PM',
      monthStart, monthEnd
    )
    expect(days).toBe(3)
  })

  it('should count only days in current month when leave spans from previous month', () => {
    // Mar 31 (Tue, PM) -> Apr 2 (Thu, PM). Apr portion: Apr 1-2 = 2 days
    const days = calculateLeaveDaysInMonth(
      new Date('2026-03-31'), new Date('2026-04-02'),
      'PM', 'PM',
      monthStart, monthEnd
    )
    expect(days).toBe(2)
  })

  it('should count only days in current month when leave spans to next month', () => {
    // Apr 28 (Tue, AM) -> May 1 (Fri, PM). Apr portion: Apr 28-30 = 3 days
    const days = calculateLeaveDaysInMonth(
      new Date('2026-04-28'), new Date('2026-05-01'),
      'AM', 'PM',
      monthStart, monthEnd
    )
    expect(days).toBe(3)
  })

  it('should exclude weekends for cross-month leave', () => {
    // Mar 30 (Mon) -> Apr 6 (Mon). Apr 4-5 is weekend
    // Apr portion working days: Apr 1-3, Apr 6 = 4 days
    const days = calculateLeaveDaysInMonth(
      new Date('2026-03-30'), new Date('2026-04-06'),
      'AM', 'PM',
      monthStart, monthEnd
    )
    expect(days).toBe(4)
  })

  it('should respect original session when boundary matches leave start/end', () => {
    // Apr 1 (Wed, PM) -> Apr 2 (Thu, AM). Original sessions apply
    const days = calculateLeaveDaysInMonth(
      new Date('2026-04-01'), new Date('2026-04-02'),
      'PM', 'AM',
      monthStart, monthEnd
    )
    expect(days).toBe(1)
  })

  it('should use default full-day session when truncated at month boundary', () => {
    // Mar 31 (PM) -> Apr 1 (AM). Truncated at month start, so Apr 1 uses AM default
    // Apr 1 AM = 0.5 day
    const days = calculateLeaveDaysInMonth(
      new Date('2026-03-31'), new Date('2026-04-01'),
      'PM', 'AM',
      monthStart, monthEnd
    )
    expect(days).toBe(0.5)
  })

  it('should exclude legal holidays in current month portion', () => {
    // Apr 1 (Wed) -> Apr 3 (Fri), with Apr 2 as holiday
    const days = calculateLeaveDaysInMonth(
      new Date('2026-04-01'), new Date('2026-04-03'),
      'AM', 'PM',
      monthStart, monthEnd,
      { legalHolidayDates: ['2026-04-02'], compensatoryWorkDates: [] }
    )
    expect(days).toBe(2)
  })
})


describe('calculateHourlyRate', () => {
  it('calculates hourly rate from monthly base salary only', () => {
    // 4350 / 21.75 / 8 = 25
    const rate = calculateHourlyRate(4350)
    expect(rate).toBe(25)
  })

  it('calculates hourly rate from base salary plus seniority pay', () => {
    // (4350 + 500) / 21.75 / 8 ≈ 27.873...
    const rate = calculateHourlyRate(4850)
    expect(rate).toBeCloseTo(27.87, 2)
  })
})

describe('calculateOvertimePay', () => {
  it('calculates workday overtime pay with seniority-inclusive hourly rate', () => {
    // 2 hours * 27.87 * 1.5 = 83.61
    const pay = calculateOvertimePay(2, 27.87, 'WORKDAY')
    expect(pay).toBeCloseTo(83.61, 2)
  })

  it('calculates weekend overtime pay', () => {
    // 4 hours * 27.87 * 2 = 222.96
    const pay = calculateOvertimePay(4, 27.87, 'WEEKEND')
    expect(pay).toBeCloseTo(222.96, 2)
  })

  it('calculates holiday overtime pay', () => {
    // 1 hour * 27.87 * 3 = 83.61
    const pay = calculateOvertimePay(1, 27.87, 'HOLIDAY')
    expect(pay).toBeCloseTo(83.61, 2)
  })
})

describe('calculateOvertimeAllocation', () => {
  it('pays all hours when total is within 36h limit', () => {
    const overtimeData = [
      { type: 'WORKDAY' as const, hours: 10 },
      { type: 'WEEKEND' as const, hours: 8 },
    ]
    const result = calculateOvertimeAllocation(overtimeData, 25)
    expect(result.paidHours).toHaveLength(2)
    expect(result.compensatoryHours).toBe(0)
    // 10*25*1.5 + 8*25*2 = 375 + 400 = 775
    expect(result.totalPay).toBeCloseTo(775, 2)
  })

  it('allocates excess hours to compensatory leave with seniority-inclusive rate', () => {
    // Total 40 hours, max paid 36 hours
    // Pay priority: HOLIDAY > WEEKEND > WORKDAY
    const overtimeData = [
      { type: 'WORKDAY' as const, hours: 20 },
      { type: 'WEEKEND' as const, hours: 12 },
      { type: 'HOLIDAY' as const, hours: 8 },
    ]
    const result = calculateOvertimeAllocation(overtimeData, 27.87)
    expect(result.paidHours.reduce((sum, item) => sum + item.hours, 0)).toBe(36)
    expect(result.compensatoryHours).toBe(4)
    // HOLIDAY 8h + WEEKEND 12h + WORKDAY 16h = 36h paid
    // WORKDAY 4h -> compensatory
    expect(result.paidHours.find((item) => item.type === 'HOLIDAY')?.hours).toBe(8)
    expect(result.paidHours.find((item) => item.type === 'WEEKEND')?.hours).toBe(12)
    expect(result.paidHours.find((item) => item.type === 'WORKDAY')?.hours).toBe(16)
  })
})
