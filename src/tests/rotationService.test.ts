import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null })
        })
      })
    })
  }
}))

import { getTimeRemaining } from '../services/rotationService'

describe('rotationService.ts tests', () => {
  it('should calculate time remaining correctly', () => {
    const durationMinutes = 15
    const now = Date.now()
    const timerEndAt = new Date(now + durationMinutes * 60 * 1000).toISOString()
    
    const remaining = getTimeRemaining(timerEndAt)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(900)
  })

  it('should return 0 when timerEndAt is null or in the past', () => {
    expect(getTimeRemaining(null)).toBe(0)
    
    const pastTime = new Date(Date.now() - 1000).toISOString()
    expect(getTimeRemaining(pastTime)).toBe(0)
  })
})
