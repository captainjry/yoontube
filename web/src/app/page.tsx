import React from 'react'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { LibraryShell } from '../components/library-shell'
import {
  BackendUnauthorizedError,
  getMediaIndexFromBackend,
  isBackendUnauthorizedError,
  SESSION_COOKIE_NAME,
} from '../lib/backend'
import type { MediaFilter, MediaItem } from '../lib/types'

type HomePageProps = {
  searchParams?: Promise<{
    filter?: string
  }>
}

function normalizeFilter(filter: string | undefined): MediaFilter {
  if (filter === 'videos' || filter === 'photos') {
    return filter
  }

  return 'all'
}

function filterItems(items: MediaItem[], filter: MediaFilter) {
  if (filter === 'videos') {
    return items.filter((item) => item.kind === 'video')
  }

  if (filter === 'photos') {
    return items.filter((item) => item.kind === 'photo')
  }

  return items
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const activeFilter = normalizeFilter(resolvedSearchParams.filter)
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const sessionCookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : undefined

  try {
    const items = await getMediaIndexFromBackend(sessionCookieHeader)

    return <LibraryShell activeFilter={activeFilter} items={filterItems(items, activeFilter)} />
  } catch (error) {
    if (error instanceof BackendUnauthorizedError || isBackendUnauthorizedError(error)) {
      redirect('/login')
      return null
    }

    throw error
  }
}
