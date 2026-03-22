import type { FrontendSessionCookie, MediaItem, MediaPlaybackMode, VerifyPasswordResult } from './types'

export const SESSION_COOKIE_NAME = 'session'

const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:4000'

export const FRONTEND_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export class BackendUnauthorizedError extends Error {
  constructor() {
    super('Backend request was unauthorized')
    this.name = 'BackendUnauthorizedError'
  }
}

function isMediaKind(value: unknown): value is MediaItem['kind'] {
  return value === 'video' || value === 'photo'
}

function isPlaybackMode(value: unknown): value is MediaPlaybackMode {
  return value === 'playable_in_browser' || value === 'preview_only' || value === 'unsupported'
}

function isMediaItem(value: unknown): value is MediaItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const title = candidate.title ?? candidate.name

  return (
    typeof candidate.id === 'string' &&
    typeof title === 'string' &&
    isMediaKind(candidate.kind) &&
    (candidate.mimeType === undefined || typeof candidate.mimeType === 'string') &&
    (candidate.playbackMode === undefined || isPlaybackMode(candidate.playbackMode)) &&
    (candidate.folderPath === undefined || typeof candidate.folderPath === 'string') &&
    (candidate.folderPathSegments === undefined || isFolderPathSegments(candidate.folderPathSegments))
  )
}

type MediaItemCandidate = Record<string, unknown> & {
  id: string
  kind: MediaItem['kind']
  title?: unknown
  name?: unknown
  mimeType?: unknown
  playbackMode?: unknown
  folderPath?: unknown
  folderPathSegments?: unknown
}

function isFolderPathSegments(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((segment) => typeof segment === 'string')
}

function normalizeMediaItem(value: MediaItemCandidate): MediaItem {
  return {
    id: value.id,
    kind: value.kind,
    title: String(value.title ?? value.name),
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : undefined,
    playbackMode: isPlaybackMode(value.playbackMode) ? value.playbackMode : undefined,
    folderPath: typeof value.folderPath === 'string' ? value.folderPath : undefined,
    folderPathSegments: isFolderPathSegments(value.folderPathSegments) ? value.folderPathSegments : undefined,
  }
}

function parseMediaIndexPayload(data: unknown): MediaItem[] {
  const items = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : null

  if (!items) {
    throw new Error('Invalid media index payload')
  }

  const mediaItems: MediaItem[] = []

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Invalid media index payload')
    }

    if ((item as { kind?: unknown }).kind === 'other') {
      continue
    }

    if (!isMediaItem(item)) {
      throw new Error('Invalid media index payload')
    }

    mediaItems.push(normalizeMediaItem(item))
  }

  return mediaItems
}

export function isBackendUnauthorizedError(error: unknown): error is BackendUnauthorizedError {
  return error instanceof BackendUnauthorizedError || (error instanceof Error && error.name === 'BackendUnauthorizedError')
}

export function getBackendBaseUrl() {
  return process.env.BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL
}

export function parseBackendSessionCookie(setCookieHeader: string | null): FrontendSessionCookie | null {
  if (!setCookieHeader) {
    return null
  }

  const match = setCookieHeader.match(new RegExp(`(?:^|,\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))

  if (!match) {
    return null
  }

  return {
    name: SESSION_COOKIE_NAME,
    value: match[1],
  }
}

export async function verifyPasswordWithBackend(password: string): Promise<VerifyPasswordResult> {
  let response: Response

  try {
    response = await fetch(`${getBackendBaseUrl()}/auth/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ password }),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, error: 'Unable to reach auth service' }
  }

  if (response.status === 400) {
    return { ok: false, error: 'Password is required' }
  }

  if (response.status === 401) {
    return { ok: false, error: 'Invalid password' }
  }

  if (!response.ok) {
    return { ok: false, error: 'Unable to verify password' }
  }

  const sessionCookie = parseBackendSessionCookie(response.headers.get('set-cookie'))

  if (!sessionCookie) {
    return { ok: false, error: 'Backend session cookie missing' }
  }

  return {
    ok: true,
    cookie: sessionCookie,
  }
}

export async function getMediaIndexFromBackend(sessionCookieHeader?: string): Promise<MediaItem[]> {
  const response = await fetch(`${getBackendBaseUrl()}/media`, {
    headers: sessionCookieHeader
      ? {
          cookie: sessionCookieHeader,
        }
      : undefined,
    cache: 'no-store',
  })

  if (response.status === 401) {
    throw new BackendUnauthorizedError()
  }

  if (!response.ok) {
    throw new Error('Unable to fetch media index')
  }

  const data = (await response.json()) as unknown

  return parseMediaIndexPayload(data)
}
