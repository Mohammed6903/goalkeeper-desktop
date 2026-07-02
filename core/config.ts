/** Coefficients for the deterministic urgency polynomial (see urgency.ts).
 * Ported 1:1 from GoalKeeper's Python `UrgencyConfig` defaults. */
export interface UrgencyConfig {
  due: number
  due_horizon_days: number
  overdue: number
  priority_high: number
  priority_medium: number
  priority_low: number
  age: number
  age_horizon_days: number
  active: number
  blocking: number
  blocked: number
  tag_next: number
  goal_priority: number
}

export const defaultUrgencyConfig = (): UrgencyConfig => ({
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
