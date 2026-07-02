/**
 * Gemini Developer API client wrapper.
 *
 * Pure module — no Electron imports — so it is unit-testable in a plain Node
 * environment.  Callers (Electron IPC handlers) are responsible for supplying
 * the API key they read from the OS keychain.
 */

import { GoogleGenAI } from '@google/genai'
import { z, type ZodType } from 'zod'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NoApiKeyError extends Error {
  constructor() {
    super('No Gemini API key configured. Set one in Settings → AI.')
    this.name = 'NoApiKeyError'
  }
}

export class GeminiParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiParseError'
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface GeminiClientOptions {
  apiKey: string
  model: string
  fastModel: string
}

export class GeminiClient {
  private readonly apiKey: string
  private readonly model: string
  private readonly fastModel: string

  constructor(opts: GeminiClientOptions) {
    this.apiKey = opts.apiKey
    this.model = opts.model
    this.fastModel = opts.fastModel
  }

  /**
   * Call the Gemini API with `responseMimeType: 'application/json'`, then
   * validate and return the parsed response through the supplied Zod schema.
   *
   * Verified against @google/genai v2.x types:
   *   ai.models.generateContent({ model, contents, config: { responseMimeType } })
   *   response.text  → string | undefined
   */
  async generateStructured<T>(
    prompt: string,
    schema: ZodType<T>,
    opts?: { fast?: boolean },
  ): Promise<T> {
    if (!this.apiKey) {
      throw new NoApiKeyError()
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey })
    const modelId = opts?.fast ? this.fastModel : this.model

    // Constrain the model to the exact object shape — otherwise Gemini is free
    // to return e.g. a bare JSON array, which then fails schema validation.
    let responseJsonSchema: Record<string, unknown> | undefined
    try {
      responseJsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
      delete responseJsonSchema.$schema // Gemini rejects the meta key
    } catch {
      responseJsonSchema = undefined // fall back to unconstrained JSON
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(responseJsonSchema ? { responseJsonSchema } : {}),
      },
    })

    const raw = response.text
    if (raw == null) {
      throw new GeminiParseError('Gemini returned an empty response (no text part).')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      const snippet = raw.slice(0, 200)
      throw new GeminiParseError(
        `Gemini response is not valid JSON. Snippet: ${snippet}`,
      )
    }

    try {
      return schema.parse(parsed)
    } catch (err) {
      throw new GeminiParseError(
        `Gemini response did not match the expected shape: ${(err as Error).message}`,
      )
    }
  }
}
