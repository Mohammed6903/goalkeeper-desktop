/**
 * OS-keychain-backed API key storage using Electron safeStorage.
 *
 * safeStorage encrypts the key with the OS credential store (Keychain on macOS,
 * libsecret on Linux, DPAPI on Windows).  On Linux systems without a keyring
 * daemon (e.g. a bare CI container), safeStorage.isEncryptionAvailable() returns
 * false and we fall back to storing the value as plain UTF-8 in the same file.
 * The fallback is noted with a comment in the file but is otherwise transparent.
 *
 * The encrypted (or plain) bytes are written to:
 *   <userData>/secret.bin
 */

import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

function secretPath(): string {
  return join(app.getPath('userData'), 'secret.bin')
}

/** Write the API key to disk, encrypted when possible. */
export function setApiKey(value: string): void {
  const p = secretPath()
  if (!value) {
    // Delete the file so getApiKeyStatus() returns false
    if (existsSync(p)) {
      unlinkSync(p)
    }
    return
  }

  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(p, safeStorage.encryptString(value))
  } else {
    // Fallback: plaintext storage (no OS keyring available).
    // The leading marker lets readApiKey() detect the encoding.
    writeFileSync(p, 'PLAIN:' + value, 'utf8')
  }
}

/** Read and decrypt the stored API key.  Returns '' if absent or corrupt. */
export function readApiKey(): string {
  const p = secretPath()
  if (!existsSync(p)) return ''
  try {
    const data = readFileSync(p)
    if (safeStorage.isEncryptionAvailable()) {
      // Detect plaintext fallback written before encryption became available
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

/** Returns true if a non-empty key is stored. */
export function hasApiKey(): boolean {
  return readApiKey().length > 0
}
