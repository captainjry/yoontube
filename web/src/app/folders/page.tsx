import React from 'react'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  BackendUnauthorizedError,
  getMediaIndexFromBackend,
  isBackendUnauthorizedError,
  SESSION_COOKIE_NAME,
} from '../../lib/backend'
import type { MediaItem } from '../../lib/types'

function buildFolderTree(items: MediaItem[]) {
  const tree: Record<string, { videoCount: number; photoCount: number; totalCount: number; subfolders: Set<string> }> = {}

  for (const item of items) {
    const path = item.folderPath || ''
    const segments = item.folderPathSegments ?? (path ? path.split('/') : [])

    // Register this item's immediate folder
    const topLevel = segments[0] ?? ''
    if (!topLevel) continue

    if (!tree[topLevel]) {
      tree[topLevel] = { videoCount: 0, photoCount: 0, totalCount: 0, subfolders: new Set() }
    }

    tree[topLevel].totalCount++
    if (item.kind === 'video') tree[topLevel].videoCount++
    if (item.kind === 'photo') tree[topLevel].photoCount++

    // Track subfolders
    if (segments.length > 1) {
      tree[topLevel].subfolders.add(segments.slice(1).join('/'))
    }
  }

  return Object.entries(tree)
    .map(([name, stats]) => ({
      name,
      ...stats,
      subfolderCount: stats.subfolders.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default async function FoldersPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const sessionCookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : undefined

  try {
    const items = await getMediaIndexFromBackend(sessionCookieHeader)
    const folders = buildFolderTree(items)
    const rootItems = items.filter((i) => !i.folderPath)

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

        <div className="app-shell">
          <header className="library-header">
            <div className="animate-enter">
              <p className="label label--accent">Browse</p>
              <h1 className="display-xl" style={{ marginTop: '0.5rem' }}>Folders</h1>
              <div className="library-header__meta">
                <span className="library-header__stat">{folders.length} folders</span>
                <span className="library-header__dot" />
                <span className="library-header__stat">{items.length} total items</span>
              </div>
            </div>
          </header>

          <section className="stagger-grid folder-grid">
            {rootItems.length > 0 && (
              <Link href="/folders/_root" className="folder-card">
                <div className="folder-card__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="folder-card__body">
                  <h2 className="folder-card__name">Root</h2>
                  <p className="folder-card__meta">{rootItems.length} items</p>
                </div>
              </Link>
            )}

            {folders.map((folder) => (
              <Link key={folder.name} href={`/folders/${encodeURIComponent(folder.name)}`} className="folder-card">
                <div className="folder-card__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="folder-card__body">
                  <h2 className="folder-card__name">{folder.name}</h2>
                  <p className="folder-card__meta">
                    {folder.totalCount} items
                    {folder.videoCount > 0 && <span> &middot; {folder.videoCount} videos</span>}
                    {folder.photoCount > 0 && <span> &middot; {folder.photoCount} photos</span>}
                    {folder.subfolderCount > 0 && <span> &middot; {folder.subfolderCount} subfolders</span>}
                  </p>
                </div>
                <div className="folder-card__arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
          </section>
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
