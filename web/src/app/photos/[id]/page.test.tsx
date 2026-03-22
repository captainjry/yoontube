import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetMediaIndexFromBackend, mockRedirect, mockNotFound } = vi.hoisted(() => ({
  mockGetMediaIndexFromBackend: vi.fn(),
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
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
  notFound: mockNotFound,
}))

vi.mock('../../../lib/backend', () => ({
  getMediaIndexFromBackend: mockGetMediaIndexFromBackend,
  BackendUnauthorizedError: class BackendUnauthorizedError extends Error {},
  isBackendUnauthorizedError: (error: unknown) =>
    error instanceof Error && error.name === 'BackendUnauthorizedError',
  SESSION_COOKIE_NAME: 'session',
}))

import PhotoPage from './page'

describe('PhotoPage', () => {
  beforeEach(() => {
    mockRedirect.mockReset()
    mockNotFound.mockReset()
    mockGetMediaIndexFromBackend.mockReset()
    mockGetMediaIndexFromBackend.mockResolvedValue([
      {
        id: 'photo-1',
        kind: 'photo',
        title: 'Raw studio still',
        mimeType: 'image/x-canon-cr2',
        playbackMode: 'preview_only',
      },
    ])
  })

  it('renders a Drive fallback for preview-only photos', async () => {
    const ui = await PhotoPage({ params: Promise.resolve({ id: 'photo-1' }) })
    const html = renderToStaticMarkup(ui)

    expect(html).toContain('Original Required')
    expect(html).toContain('Back to library')
    expect(html).toContain('Open in Drive')
    expect(html).toContain('https://drive.google.com/file/d/photo-1/view')
    expect(html).toContain('Raw studio still')
  })

  it('uses notFound when the requested photo is missing', async () => {
    mockGetMediaIndexFromBackend.mockResolvedValueOnce([])

    await PhotoPage({ params: Promise.resolve({ id: 'missing-photo' }) })

    expect(mockNotFound).toHaveBeenCalledTimes(1)
    expect(mockRedirect).not.toHaveBeenCalledWith('/')
  })
})
