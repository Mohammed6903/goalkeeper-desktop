import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { AppConfig, defaultAppConfig } from './config'

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
