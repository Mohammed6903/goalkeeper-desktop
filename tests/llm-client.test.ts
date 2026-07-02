import { describe, it, expect } from 'vitest'
import { GeminiClient, NoApiKeyError } from '@core/llm/client'
import { whatNowResultSchema } from '@core/llm/schemas'

describe('GeminiClient', () => {
  it('throws NoApiKeyError when key missing', async () => {
    const c = new GeminiClient({ apiKey: '', model: 'gemini-2.5-pro', fastModel: 'gemini-2.5-flash' })
    await expect(c.generateStructured('hi', whatNowResultSchema)).rejects.toBeInstanceOf(NoApiKeyError)
  })
})
