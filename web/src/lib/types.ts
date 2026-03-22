export type FrontendSessionCookie = {
  name: string
  value: string
}

export type VerifyPasswordResult =
  | {
      ok: true
      cookie: FrontendSessionCookie
    }
  | {
      ok: false
      error: string
    }

export type LoginState = {
  error: string | null
}

export type MediaKind = 'video' | 'photo'

export type MediaFilter = 'all' | 'videos' | 'photos'

export type MediaPlaybackMode = 'playable_in_browser' | 'preview_only' | 'unsupported'

export type MediaItem = {
  id: string
  kind: MediaKind
  title: string
  mimeType?: string
  playbackMode?: MediaPlaybackMode
  folderPath?: string
  folderPathSegments?: string[]
}
