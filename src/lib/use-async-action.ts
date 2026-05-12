'use client'

import { useCallback, useRef, useState } from 'react'

interface UseAsyncActionOptions {
  timeout?: number
  onError?: (message: string) => void
}

interface UseAsyncActionResult<T extends (...args: never[]) => Promise<unknown>> {
  loading: boolean
  error: string | null
  execute: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | { error: string }>
  reset: () => void
}

export function useAsyncAction<T extends (...args: never[]) => Promise<unknown>>(
  asyncFn: T,
  options: UseAsyncActionOptions = {}
): UseAsyncActionResult<T> {
  const { timeout = 10000, onError } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(false)

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | { error: string }> => {
      setLoading(true)
      setError(null)
      activeRef.current = true

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('请求超时，请稍后重试'))
        }, timeout)
      })

      try {
        const result = (await Promise.race([asyncFn(...args), timeoutPromise])) as Awaited<ReturnType<T>>
        if (activeRef.current) {
          setLoading(false)
          activeRef.current = false
        }
        return result
      } catch (err) {
        if (activeRef.current) {
          const message = err instanceof Error ? err.message : '请求失败，请稍后重试'
          setLoading(false)
          setError(message)
          activeRef.current = false
          onError?.(message)
        }
        return { error: err instanceof Error ? err.message : '请求失败，请稍后重试' }
      }
    },
    [asyncFn, timeout, onError]
  )

  return { loading, error, execute, reset }
}
