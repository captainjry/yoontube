import React from 'react'
import Link from 'next/link'

import type { MediaFilter, MediaItem } from '../lib/types'
import { FilterTabs } from './filter-tabs'
import { MediaGrid } from './media-grid'

type LibraryShellProps = {
  activeFilter: MediaFilter
  items: MediaItem[]
}

export function LibraryShell({ activeFilter, items }: LibraryShellProps) {
  const videoCount = items.filter((item) => item.kind === 'video').length
  const photoCount = items.filter((item) => item.kind === 'photo').length
  const isGalleryLayout = activeFilter === 'photos'

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-primary)' }}>
      <div className="app-shell">
        <header className="library-header">
          <div className="library-header__top">
            <div className="animate-enter">
              <p className="label label--accent">Collection</p>
              <h1 className="display-xl" style={{ marginTop: '0.5rem' }}>
                Yoontube
                <span
                  className="label"
                  style={{
                    verticalAlign: 'super',
                    fontSize: '0.5em',
                    marginLeft: '0.75rem',
                    color: 'var(--color-text-tertiary)',
                    letterSpacing: '0.14em',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Archive
                </span>
              </h1>
              <div className="library-header__meta">
                <span className="library-header__stat">
                  {items.length} items
                </span>
                <span className="library-header__dot" />
                <span className="library-header__stat">
                  {videoCount} videos
                </span>
                <span className="library-header__dot" />
                <span className="library-header__stat">
                  {photoCount} photos
                </span>
              </div>
            </div>

            <div className="animate-enter-delayed" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <FilterTabs activeFilter={activeFilter} />
              <Link href="/folders" className="filter-pill filter-pill--inactive" style={{ gap: '0.375rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Folders
              </Link>
            </div>
          </div>
        </header>

        <section>
          {items.length > 0 ? (
            <MediaGrid items={items} isGalleryLayout={isGalleryLayout} />
          ) : (
            <div className="empty-state">
              <h2 className="empty-state__title">Nothing here yet</h2>
              <p className="empty-state__copy">No media found for this filter.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
