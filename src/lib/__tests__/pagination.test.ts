import { describe, expect, it } from 'vitest'
import { getPaginationState, getTotalPages } from '../pagination'

describe('pagination helpers', () => {
  it('returns at least one page', () => {
    expect(getTotalPages(0, 10)).toBe(1)
  })

  it('clamps current page into a valid range', () => {
    expect(getPaginationState(25, 99, 10)).toMatchObject({
      currentPage: 3,
      startIndex: 20,
      endIndex: 30,
      totalPages: 3,
    })
  })

  it('starts from zero when there are no items', () => {
    expect(getPaginationState(0, 3, 10)).toMatchObject({
      currentPage: 1,
      startIndex: 0,
      endIndex: 10,
      totalPages: 1,
    })
  })
})
