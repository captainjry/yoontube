import React from 'react'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MediaGrid } from '../../../components/media-grid'
import { FilterTabs } from '../../../components/filter-tabs'
import {
  BackendUnauthorizedError,
  getMediaIndexFromBackend,
  isBackendUnauthorizedError,
  SESSION_COOKIE_NAME,
} from '../../../lib/backend'
import type { MediaFilter, MediaItem } from '../../../lib/types'

type FolderPageProps = {
  params: Promise<{ path: string[] }>
  searchParams?: Promise<{ filter?: string }>
}

function normalizeFilter(filter: string | undefined): MediaFilter {
  if (filter === 'videos' || filter === 'photos') return filter
  return 'all'
}

function filterItems(items: MediaItem[], filter: MediaFilter) {
  if (filter === 'videos') return items.filter((item) => item.kind === 'video')
  if (filter === 'photos') return items.filter((item) => item.kind === 'photo')
  return items
}

function getSubfolders(items: MediaItem[], currentPath: string): string[] {
  const subfolders = new Set<string>()

  for (const item of items) {
    const path = item.folderPath || ''
    if (!path.startsWith(currentPath) || path === currentPath) continue

    const remainder = path.slice(currentPath.length + 1)
    const nextSegment = remainder.split('/')[0]
    if (nextSegment) {
      subfolders.add(nextSegment)
    }
  }

  return [...subfolders].sort()
}

function getItemsInFolder(items: MediaItem[], folderPath: string): MediaItem[] {
  return items.filter((item) => (item.folderPath || '') === folderPath)
}

export default async function FolderContentsPage({ params, searchParams }: FolderPageProps) {
  const { path: pathSegments } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const activeFilter = normalizeFilter(resolvedSearchParams.filter)

  const isRoot = pathSegments.length === 1 && pathSegments[0] === '_root'
  const decodedSegments = pathSegments.map(decodeURIComponent)
  const folderPath = isRoot ? '' : decodedSegments.join('/')
  const folderName = isRoot ? 'Root' : decodedSegments[decodedSegments.length - 1]

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const sessionCookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : undefined

  try {
    const allItems = await getMediaIndexFromBackend(sessionCookieHeader)

    // Items directly in this folder
    const directItems = getItemsInFolder(allItems, folderPath)

    // Items in this folder and all subfolders
    const allFolderItems = isRoot
      ? allItems.filter((i) => !i.folderPath)
      : allItems.filter((i) => (i.folderPath || '').startsWith(folderPath))

    // Subfolders
    const subfolders = isRoot ? [] : getSubfolders(allItems, folderPath)

    const filteredItems = filterItems(directItems, activeFilter)
    const isGalleryLayout = activeFilter === 'photos'

    // Breadcrumb segments
    const breadcrumbs = isRoot
      ? [{ label: 'Root', href: '/folders/_root' }]
      : decodedSegments.map((seg, i) => ({
          label: seg,
          href: `/folders/${decodedSegments.slice(0, i + 1).map(encodeURIComponent).join('/')}`,
        }))

    // Back button goes to parent folder, or /folders if at top level
    const parentHref = isRoot || decodedSegments.length <= 1
      ? '/folders'
      : `/folders/${decodedSegments.slice(0, -1).map(encodeURIComponent).join('/')}`

    const videoCount = directItems.filter((i) => i.kind === 'video').length
    const photoCount = directItems.filter((i) => i.kind === 'photo').length

    // Build filter hrefs with folder prefix
    const filterBase = isRoot ? '/folders/_root' : `/folders/${decodedSegments.map(encodeURIComponent).join('/')}`

    return (
      <main className="min-h-dvh" style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-primary)' }}>
        <header className="detail-header animate-fade">
          <Link href={parentHref} className="detail-back" aria-label="Back to folders">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18L9 12L15 6" />
            </svg>
          </Link>
          <span className="detail-brand">Yoontube</span>
        </header>

        <div className="app-shell">
          <header className="library-header">
            <div className="library-header__top">
              <div className="animate-enter">
                {/* Breadcrumb */}
                <nav className="breadcrumb" aria-label="Folder path">
                  <Link href="/folders" className="breadcrumb__link">Folders</Link>
                  {breadcrumbs.map((crumb, i) => (
                    <React.Fragment key={crumb.href}>
                      <span className="breadcrumb__sep">/</span>
                      {i === breadcrumbs.length - 1 ? (
                        <span className="breadcrumb__current">{crumb.label}</span>
                      ) : (
                        <Link href={crumb.href} className="breadcrumb__link">{crumb.label}</Link>
                      )}
                    </React.Fragment>
                  ))}
                </nav>

                <h1 className="display-xl" style={{ marginTop: '0.5rem' }}>{folderName}</h1>
                <div className="library-header__meta">
                  <span className="library-header__stat">{directItems.length} items</span>
                  {videoCount > 0 && (
                    <>
                      <span className="library-header__dot" />
                      <span className="library-header__stat">{videoCount} videos</span>
                    </>
                  )}
                  {photoCount > 0 && (
                    <>
                      <span className="library-header__dot" />
                      <span className="library-header__stat">{photoCount} photos</span>
                    </>
                  )}
                  {subfolders.length > 0 && (
                    <>
                      <span className="library-header__dot" />
                      <span className="library-header__stat">{subfolders.length} subfolders</span>
                    </>
                  )}
                </div>
              </div>

              <div className="animate-enter-delayed">
                <FolderFilterTabs activeFilter={activeFilter} baseHref={filterBase} />
              </div>
            </div>
          </header>

          {/* Subfolders */}
          {subfolders.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <p className="label" style={{ marginBottom: '1rem' }}>Subfolders</p>
              <div className="stagger-grid subfolder-grid">
                {subfolders.map((sub) => {
                  const subPath = `${folderPath}/${sub}`
                  const subCount = allItems.filter((i) => (i.folderPath || '').startsWith(subPath)).length

                  return (
                    <Link
                      key={sub}
                      href={`/folders/${[...decodedSegments, sub].map(encodeURIComponent).join('/')}`}
                      className="folder-card folder-card--compact"
                    >
                      <div className="folder-card__icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <div className="folder-card__body">
                        <h2 className="folder-card__name">{sub}</h2>
                        <p className="folder-card__meta">{subCount} items</p>
                      </div>
                      <div className="folder-card__arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Media items in this folder */}
          <section>
            {filteredItems.length > 0 ? (
              <MediaGrid items={filteredItems} isGalleryLayout={isGalleryLayout} />
            ) : (
              <div className="empty-state">
                <h2 className="empty-state__title">No media here</h2>
                <p className="empty-state__copy">
                  {subfolders.length > 0
                    ? 'This folder only contains subfolders. Browse into them to find media.'
                    : 'No media found for this filter.'}
                </p>
              </div>
            )}
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

function FolderFilterTabs({ activeFilter, baseHref }: { activeFilter: MediaFilter; baseHref: string }) {
  const filters: Array<{ label: string; value: MediaFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Videos', value: 'videos' },
    { label: 'Photos', value: 'photos' },
  ]

  return (
    <nav aria-label="Media filters" className="filter-nav">
      {filters.map((filter) => {
        const href = filter.value === 'all' ? baseHref : `${baseHref}?filter=${filter.value}`
        const isActive = filter.value === activeFilter

        return (
          <Link
            key={filter.value}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`filter-pill ${isActive ? 'filter-pill--active' : 'filter-pill--inactive'}`}
          >
            {filter.label}
          </Link>
        )
      })}
    </nav>
  )
}
