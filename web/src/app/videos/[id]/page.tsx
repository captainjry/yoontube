import React from 'react'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { VideoPlayer } from '../../../components/video-player'
import {
  BackendUnauthorizedError,
  isBackendUnauthorizedError,
  SESSION_COOKIE_NAME,
} from '../../../lib/backend'
import { getDriveDownloadUrl, getDriveViewUrl, getMediaDetailItem } from '../../../lib/media-detail'

type VideoPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const sessionCookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : undefined

  try {
    const item = await getMediaDetailItem(sessionCookieHeader, id, 'video')

    if (!item) {
      notFound()
      return null
    }

    const streamUrl = `/api/stream/${item.id}`

    return (
      <main className="min-h-dvh" style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-primary)' }}>
        <header className="detail-header animate-fade">
          <Link href="/" className="detail-back" aria-label="Back to library">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18L9 12L15 6" />
            </svg>
          </Link>
          <span className="detail-brand">Yoontube</span>
        </header>

        <section className="app-shell animate-enter" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '960px' }}>
            {/* Player Frame */}
            <div className="player-frame">
              {item.playbackMode === 'playable_in_browser' ? (
                <VideoPlayer title={item.title} src={streamUrl} />
              ) : (
                <div className="fallback-card" style={{ height: '100%', borderRadius: 0, border: 'none' }}>
                  <svg className="fallback-card__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="fallback-card__title">Playback unavailable</h2>
                  <p className="fallback-card__copy">
                    This video format is not browser-playable. Use Drive preview or download the original.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <a href={getDriveViewUrl(item.id)} className="btn-primary">Open in Drive</a>
                    <a href={getDriveDownloadUrl(item.id)} className="btn-secondary">Download</a>
                  </div>
                </div>
              )}
            </div>

            {/* Title & Metadata */}
            <div>
              <p className="label label--accent" style={{ marginBottom: '0.5rem' }}>Video</p>
              <h1 className="display-lg">{item.title}</h1>

              <div className="detail-meta">
                <span className="detail-meta__tag">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {item.folderPath ?? 'Library root'}
                </span>
                <span className="detail-meta__dot" />
                <span className="detail-meta__tag">
                  {item.playbackMode === 'playable_in_browser' ? 'Browser stream' : 'Drive fallback'}
                </span>
              </div>
            </div>

            {/* Playback Notes */}
            <div className="info-panel">
              <p className="info-panel__label">Playback</p>
              <p className="info-panel__text">
                Yoontube tries the cleanest viewing path first, then falls back to Drive or download when the file is less browser-friendly.
                {item.playbackMode !== 'playable_in_browser' && ' Since this is not playable directly, please use the fallback actions above.'}
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  } catch (error) {
    if (error instanceof BackendUnauthorizedError || isBackendUnauthorizedError(error)) {
      redirect('/login')
      return null
    }

    throw error
  }
}
