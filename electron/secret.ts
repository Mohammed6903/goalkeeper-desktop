/**
 * OS-keychain-backed secret storage using Electron safeStorage.
 *
 * safeStorage encrypts the value with the OS credential store (Keychain on macOS,
 * libsecret on Linux, DPAPI on Windows).  On Linux systems without a keyring
 * daemon (e.g. a bare CI container), safeStorage.isEncryptionAvailable() returns
 * false and we fall back to storing the value as plain UTF-8 in the same file.
 * The fallback is noted with a comment in the file but is otherwise transparent.
 *
 * Files:
 *   <userData>/secret.bin       — Gemini API key
 *   <userData>/mongo-uri.bin    — MongoDB connection string
 */

import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function readSecret(filePath: string): string {
  if (!existsSync(filePath)) return ''
  try {
    const data = readFileSync(filePath)
    if (safeStorage.isEncryptionAvailable()) {
      const str = data.toString('utf8')
      if (str.startsWith('PLAIN:')) {
        return str.slice(6)
      }
      return safeStorage.decryptString(data)
    } else {
      const str = data.toString('utf8')
      return str.startsWith('PLAIN:') ? str.slice(6) : str
    }
  } catch {
    return ''
  }
}

function writeSecret(filePath: string, value: string): void {
  if (!value) {
    if (existsSync(filePath)) unlinkSync(filePath)
    return
  }
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(filePath, safeStorage.encryptString(value))
  } else {
    writeFileSync(filePath, 'PLAIN:' + value, 'utf8')
  }
}

// ── Gemini API key ─────────────────────────────────────────────────────────────

function secretPath(): string {
  return join(app.getPath('userData'), 'secret.bin')
}

/** Write the API key to disk, encrypted when possible. */
export function setApiKey(value: string): void {
  writeSecret(secretPath(), value)
}

/** Read and decrypt the stored API key.  Returns '' if absent or corrupt. */
export function readApiKey(): string {
  return readSecret(secretPath())
}

/** Returns true if a non-empty key is stored. */
export function hasApiKey(): boolean {
  return readApiKey().length > 0
}

// ── MongoDB URI ────────────────────────────────────────────────────────────────

function mongoUriPath(): string {
  return join(app.getPath('userData'), 'mongo-uri.bin')
}

/** Write the MongoDB connection string to disk, encrypted when possible. */
export function setMongoUri(value: string): void {
  writeSecret(mongoUriPath(), value)
}

/** Read and decrypt the stored MongoDB URI.  Returns '' if absent or corrupt. */
export function readMongoUri(): string {
  return readSecret(mongoUriPath())
}

/** Returns true if a non-empty MongoDB URI is stored. */
export function hasMongoUri(): boolean {
  return readMongoUri().length > 0
}
