type AuthLoggerMetadata = Error | { error: Error; [key: string]: unknown }

function getAuthErrorMessage(metadata: AuthLoggerMetadata) {
  if (metadata instanceof Error) {
    return metadata.message
  }

  return metadata.error.message
}

export function isIgnorableAuthError(code: string, metadata: AuthLoggerMetadata) {
  return (
    code === 'JWT_SESSION_ERROR' &&
    getAuthErrorMessage(metadata).includes('decryption operation failed')
  )
}

export const authLogger = {
  error(code: string, metadata: AuthLoggerMetadata) {
    if (isIgnorableAuthError(code, metadata)) {
      return
    }

    console.error(
      `[next-auth][error][${code}]`,
      `\nhttps://next-auth.js.org/errors#${code.toLowerCase()}`,
      getAuthErrorMessage(metadata),
      metadata
    )
  },
}
