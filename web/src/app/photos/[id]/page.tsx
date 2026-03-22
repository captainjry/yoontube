import React from 'react'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PhotoViewer } from '../../../components/photo-viewer'
import {
  BackendUnauthorizedError,
  isBackendUnauthorizedError,
  SESSION_COOKIE_NAME,
} from '../../../lib/backend'
import { getDriveViewUrl, getMediaDetailItem } from '../../../lib/media-detail'

type PhotoPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const sessionCookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : undefined

  try {
    const item = await getMediaDetailItem(sessionCookieHeader, id, 'photo')

    if (!item) {
      notFound()
      return null
    }

    return (
      <main className="lightbox" style={{ height: '100dvh' }}>
        {/* Floating Header */}
        <div className="lightbox__header animate-fade">
          <Link
            href="/?filter=photos"
            className="detail-back"
            style={{
              background: 'rgba(26, 23, 20, 0.6)',
              backdropFilter: 'blur(12px)',
              borderColor: 'rgba(58, 51, 44, 0.5)',
            }}
            aria-label="Back to library"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18L9 12L15 6" />
            </svg>
          </Link>

          <div className="lightbox__info hidden md:block">
            <h1 className="lightbox__title">{item.title}</h1>
            <p className="lightbox__folder">{item.folderPath ?? 'Library root'}</p>
          </div>
        </div>

        {/* Viewer Area */}
        <section className="lightbox__viewer">
          {item.playbackMode === 'playable_in_browser' ? (
            <div className="lightbox__image-frame animate-scale">
              <PhotoViewer alt={item.title} src={`/api/stream/${item.id}`} />
            </div>
          ) : (
            <div className="fallback-card animate-scale" style={{ maxWidth: '420px' }}>
              <svg className="fallback-card__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="fallback-card__title">Original Required</h2>
              <p className="status-copy" style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                maxWidth: '32ch',
                lineHeight: '1.6',
                marginBottom: '1.5rem',
              }}>
                This image format (like RAW or HEIC) cannot be rendered correctly here. Please use Drive preview instead.
              </p>
              <a href={getDriveViewUrl(item.id)} className="btn-primary">Open in Drive</a>
            </div>
          )}
        </section>

        {/* Mobile Info Overlay */}
        <div className="lightbox__mobile-info">
          <h1 className="lightbox__title">{item.title}</h1>
          <p className="lightbox__folder" style={{ marginTop: '0.25rem' }}>{item.folderPath ?? 'Library root'}</p>
        </div>
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
