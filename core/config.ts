import { readFileSync, writeFileSync, existsSync } from 'node:fs'

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

/** Whole-app configuration persisted to userData/settings.json.
 * Mirrors the Python settings.yaml's `urgency` + `vertex` (model names) blocks;
 * the Gemini API key is NOT stored here (it lives in the OS keychain via safeStorage). */
export interface AppConfig {
  urgency: UrgencyConfig
  gemini: { model: string; fastModel: string }
}

export const defaultAppConfig = (): AppConfig => ({
  urgency: defaultUrgencyConfig(),
  gemini: { model: 'gemini-2.5-pro', fastModel: 'gemini-2.5-flash' },
})

/** Reads/writes AppConfig as pretty JSON. Returns defaults when the file is missing or
 * unreadable, and shallow-merges persisted values over defaults so new fields added in a
 * later version still get their default. */
export class ConfigStore {
  constructor(private path: string) {}

  get(): AppConfig {
    if (!existsSync(this.path)) return defaultAppConfig()
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<AppConfig>
      const base = defaultAppConfig()
      return {
        urgency: { ...base.urgency, ...parsed.urgency },
        gemini: { ...base.gemini, ...parsed.gemini },
      }
    } catch {
      return defaultAppConfig()
    }
  }

  save(config: AppConfig): void {
    writeFileSync(this.path, JSON.stringify(config, null, 2))
  }
}
