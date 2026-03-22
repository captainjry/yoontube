import { describe, it, expect } from 'vitest'
import { formatDuration, formatSize } from './format'

describe('formatDuration', () => {
  it('formats milliseconds to m:ss', () => {
    expect(formatDuration(65000)).toBe('1:05')
    expect(formatDuration(3600000)).toBe('60:00')
  })
  it('returns null for null/zero', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(0)).toBeNull()
  })
})

describe('formatSize', () => {
  it('formats bytes to human-readable', () => {
    expect(formatSize(1_500_000_000)).toBe('1.5 GB')
    expect(formatSize(50_000_000)).toBe('50.0 MB')
    expect(formatSize(500_000)).toBe('500 KB')
  })
  it('returns null for null/zero', () => {
    expect(formatSize(null)).toBeNull()
    expect(formatSize(0)).toBeNull()
  })
})
