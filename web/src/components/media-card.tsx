import React from 'react'
import Link from 'next/link'

import type { MediaItem } from '../lib/types'

type MediaCardProps = {
  item: MediaItem
  isGalleryLayout?: boolean
}

function getMediaHref(item: MediaItem) {
  if (item.kind === 'video') {
    return `/videos/${item.id}`
  }

  if (item.kind === 'photo') {
    return `/photos/${item.id}`
  }

  throw new Error('Unsupported media kind')
}

export function MediaCard({ item, isGalleryLayout }: MediaCardProps) {
  const isPhotoGallery = isGalleryLayout && item.kind === 'photo'
  const thumbnailSrc = `/api/thumbnail/${item.id}`

  if (isPhotoGallery) {
    return (
      <article className="media-card--gallery">
        <Link href={getMediaHref(item)} className="block w-full h-full">
          <div className="media-card__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailSrc}
              alt={item.title}
              loading="lazy"
              className="media-card__thumb-img"
            />
          </div>
          <div className="media-card__overlay">
            <p className="media-card__overlay-title">{item.title}</p>
            <p className="media-card__overlay-folder">{item.folderPath || 'Library root'}</p>
          </div>
        </Link>
      </article>
    )
  }

  return (
    <article className="media-card">
      <Link href={getMediaHref(item)} className="block">
        <div className="media-card__thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailSrc}
            alt={item.title}
            loading="lazy"
            className="media-card__thumb-img"
          />
          <span className="media-card__type-badge-overlay">
            {item.kind === 'video' ? 'Video' : 'Photo'}
          </span>
        </div>
        <div className="media-card__body">
          <h2 className="media-card__title">{item.title}</h2>
          <p className="media-card__folder">
            <svg className="media-card__folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {item.folderPath || 'Library root'}
          </p>
        </div>
      </Link>
    </article>
  )
}
