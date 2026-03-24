import { describe, expect, it } from 'vitest'

import {
  calculateAnnualLeaveEntitlement,
  calculateCompletedYears,
  calculateSeniorityPay,
} from '../seniority'

describe('seniority helpers', () => {
  it('calculates completed years by anniversary', () => {
    expect(calculateCompletedYears('2016-03-24', '2026-03-24')).toBe(10)
    expect(calculateCompletedYears('2016-03-25', '2026-03-24')).toBe(9)
  })

  it('calculates annual leave entitlement by seniority range', () => {
    expect(calculateAnnualLeaveEntitlement('2018-01-01', '2026-03-24')).toBe(5)
    expect(calculateAnnualLeaveEntitlement('2014-01-01', '2026-03-24')).toBe(10)
    expect(calculateAnnualLeaveEntitlement('2008-01-01', '2026-03-24')).toBe(15)
  })

  it('calculates seniority pay with a 1000 cap', () => {
    expect(calculateSeniorityPay('2024-03-24', '2026-03-24')).toBe(200)
    expect(calculateSeniorityPay('2010-03-24', '2026-03-24')).toBe(1000)
  })
})
