import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAsyncAction } from '../use-async-action'

describe('useAsyncAction', () => {
  it('should set loading to true during execution', async () => {
    let resolveFn: (value: string) => void
    const asyncFn = vi.fn().mockImplementation(() => new Promise<string>((resolve) => { resolveFn = resolve }))
    const { result } = renderHook(() => useAsyncAction(asyncFn))

    expect(result.current.loading).toBe(false)

    const promise = result.current.execute()
    await waitFor(() => expect(result.current.loading).toBe(true))

    resolveFn!('success')
    await promise
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('should return result on success', async () => {
    const asyncFn = vi.fn().mockResolvedValue({ data: 'ok' })
    const { result } = renderHook(() => useAsyncAction(asyncFn))

    const res = await result.current.execute()

    expect(res).toEqual({ data: 'ok' })
    await waitFor(() => expect(result.current.error).toBeNull())
  })

  it('should return error object on failure', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('something went wrong'))
    const { result } = renderHook(() => useAsyncAction(asyncFn))

    const res = await result.current.execute()

    expect(res).toEqual({ error: 'something went wrong' })
    await waitFor(() => expect(result.current.error).toBe('something went wrong'))
  })

  it('should timeout and return error', async () => {
    const asyncFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('late'), 100))
    )
    const { result } = renderHook(() => useAsyncAction(asyncFn, { timeout: 50 }))

    const res = await result.current.execute()

    expect(res).toEqual({ error: '请求超时，请稍后重试' })
    await waitFor(() => expect(result.current.error).toBe('请求超时，请稍后重试'))
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('should call onError callback on failure', async () => {
    const onError = vi.fn()
    const asyncFn = vi.fn().mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useAsyncAction(asyncFn, { onError }))

    await result.current.execute()

    await waitFor(() => expect(onError).toHaveBeenCalledWith('fail'))
  })

  it('should reset state', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useAsyncAction(asyncFn))

    await result.current.execute()
    await waitFor(() => expect(result.current.error).toBe('fail'))

    result.current.reset()

    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.loading).toBe(false)
  })

  it('should pass arguments to async function', async () => {
    const asyncFn = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useAsyncAction(asyncFn))

    await result.current.execute('arg1', 42)

    expect(asyncFn).toHaveBeenCalledWith('arg1', 42)
  })
})
