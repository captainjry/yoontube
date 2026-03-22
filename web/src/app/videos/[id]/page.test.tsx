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

import VideoPage from './page'

describe('VideoPage', () => {
  beforeEach(() => {
    mockRedirect.mockReset()
    mockNotFound.mockReset()
    mockGetMediaIndexFromBackend.mockReset()
    mockGetMediaIndexFromBackend.mockResolvedValue([
      {
        id: 'video-1',
        kind: 'video',
        title: 'Morning update',
        mimeType: 'video/mp4',
        playbackMode: 'playable_in_browser',
      },
    ])
  })

  it('renders an HTML5 player for browser-playable videos', async () => {
    const ui = await VideoPage({ params: Promise.resolve({ id: 'video-1' }) })
    const html = renderToStaticMarkup(ui)

    expect(html).toContain('Playback')
    expect(html).toContain('Back to library')
    expect(html).toContain('<video')
    expect(html).toContain('/api/stream/video-1')
    expect(html).toContain('Morning update')
  })

  it('uses notFound when the requested video is missing', async () => {
    mockGetMediaIndexFromBackend.mockResolvedValueOnce([])

    await VideoPage({ params: Promise.resolve({ id: 'missing-video' }) })

    expect(mockNotFound).toHaveBeenCalledTimes(1)
    expect(mockRedirect).not.toHaveBeenCalledWith('/')
  })
})
