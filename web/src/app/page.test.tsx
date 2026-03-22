import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetMediaIndexFromBackend, mockRedirect } = vi.hoisted(() => ({
  mockGetMediaIndexFromBackend: vi.fn(),
  mockRedirect: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({
      name: 'session',
      value: 'signed-session',
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('../lib/backend', () => ({
  getMediaIndexFromBackend: mockGetMediaIndexFromBackend,
  BackendUnauthorizedError: class BackendUnauthorizedError extends Error {},
  isBackendUnauthorizedError: (error: unknown) =>
    error instanceof Error && error.name === 'BackendUnauthorizedError',
  SESSION_COOKIE_NAME: 'session',
}))

import HomePage from './page'

describe('HomePage', () => {
  beforeEach(() => {
    mockRedirect.mockReset()
    mockGetMediaIndexFromBackend.mockReset()
    mockGetMediaIndexFromBackend.mockResolvedValue([
      {
        id: 'video-1',
        kind: 'video',
        title: 'Morning update',
      },
      {
        id: 'photo-1',
        kind: 'photo',
        title: 'Studio still',
      },
    ])
  })

  it('shows the mixed library tab shell and backend items', async () => {
    const ui = await HomePage({
      searchParams: Promise.resolve({ filter: 'all' }),
    })

    const html = renderToStaticMarkup(ui)

    expect(html).toContain('Yoontube')
    expect(html).toContain('Archive')
    expect(html).toContain('All')
    expect(html).toContain('Videos')
    expect(html).toContain('Photos')
    expect(html).toContain('Morning update')
    expect(html).toContain('Studio still')
  })

  it('filters the rendered items when the videos tab is active', async () => {
    const ui = await HomePage({
      searchParams: Promise.resolve({ filter: 'videos' }),
    })

    const html = renderToStaticMarkup(ui)

    expect(html).toContain('Morning update')
    expect(html).not.toContain('Studio still')
  })

  it('redirects to login when the backend media fetch is unauthorized', async () => {
    const unauthorizedError = new Error('unauthorized')
    unauthorizedError.name = 'BackendUnauthorizedError'
    mockGetMediaIndexFromBackend.mockRejectedValueOnce(unauthorizedError)

    await HomePage({
      searchParams: Promise.resolve({ filter: 'all' }),
    })

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
