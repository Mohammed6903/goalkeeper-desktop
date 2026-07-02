import { describe, it, expect } from 'vitest'
import { defaultUrgencyConfig } from '@core/config'

describe('UrgencyConfig', () => {
  it('matches Python defaults', () => {
    const c = defaultUrgencyConfig()
    expect(c).toMatchObject({
      due: 12,
      due_horizon_days: 14,
      overdue: 6,
      priority_high: 6,
      priority_medium: 3.9,
      priority_low: 1.8,
      age: 2,
      age_horizon_days: 30,
      active: 4,
      blocking: 5,
      blocked: -5,
      tag_next: 8,
      goal_priority: 3,
    })
  })
})
