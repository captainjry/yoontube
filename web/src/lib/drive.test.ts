import { describe, it, expect } from 'vitest'
import { extractProxyHeaders } from './drive'

describe('extractProxyHeaders', () => {
  it('extracts only allowed headers', () => {
    const raw = new Headers({
      'content-type': 'video/mp4',
      'content-range': 'bytes 0-999/5000',
      'content-length': '1000',
      'accept-ranges': 'bytes',
      'cache-control': 'private',
      'x-secret': 'should-not-appear',
    })

    const result = extractProxyHeaders(raw)
    expect(result.get('content-type')).toBe('video/mp4')
    expect(result.get('content-range')).toBe('bytes 0-999/5000')
    expect(result.has('x-secret')).toBe(false)
  })
})
