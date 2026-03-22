'use client'

import React, { useState } from 'react'

import type { MediaItem } from '../lib/types'
import { MediaCard } from './media-card'

type MediaGridProps = {
  items: MediaItem[]
  isGalleryLayout: boolean
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 48

export function MediaGrid({ items, isGalleryLayout, pageSize = DEFAULT_PAGE_SIZE }: MediaGridProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const visibleItems = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length
  const remaining = items.length - visibleCount

  return (
    <>
      <div className={`stagger-grid ${isGalleryLayout ? 'media-grid--gallery' : 'media-grid'}`}>
        {visibleItems.map((item) => (
          <MediaCard key={item.id} item={item} isGalleryLayout={isGalleryLayout} />
        ))}
      </div>

      {hasMore && (
        <div className="load-more">
          <button
            type="button"
            className="load-more__button"
            onClick={() => setVisibleCount((prev) => prev + pageSize)}
          >
            Load more ({remaining} remaining)
          </button>
        </div>
      )}
    </>
  )
}
