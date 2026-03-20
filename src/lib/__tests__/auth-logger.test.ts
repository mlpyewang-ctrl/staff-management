import { describe, expect, it, vi, afterEach } from 'vitest'
import { authLogger, isIgnorableAuthError } from '../auth-logger'

describe('isIgnorableAuthError', () => {
  it('returns true for stale encrypted session cookies', () => {
    expect(
      isIgnorableAuthError(
        'JWT_SESSION_ERROR',
        new Error('JWEDecryptionFailed: decryption operation failed')
      )
    ).toBe(true)
  })

  it('returns false for other auth errors', () => {
    expect(
      isIgnorableAuthError(
        'JWT_SESSION_ERROR',
        new Error('Unexpected session failure')
      )
    ).toBe(false)
    expect(
      isIgnorableAuthError(
        'CALLBACK_CREDENTIALS_JWT_ERROR',
        new Error('JWEDecryptionFailed: decryption operation failed')
      )
    ).toBe(false)
  })
})

describe('authLogger.error', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips noisy stale-session decryption errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    authLogger.error(
      'JWT_SESSION_ERROR',
      new Error('JWEDecryptionFailed: decryption operation failed')
    )

    expect(consoleError).not.toHaveBeenCalled()
  })

  it('logs unexpected auth errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    authLogger.error(
      'JWT_SESSION_ERROR',
      new Error('Unexpected session failure')
    )

    expect(consoleError).toHaveBeenCalledOnce()
  })
})
