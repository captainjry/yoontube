import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MediaCard } from './media-card'

describe('MediaCard', () => {
  it('renders the indexed folder path when available', () => {
    const markup = renderToStaticMarkup(
      <MediaCard
        item={{
          id: 'video-1',
          kind: 'video',
          title: 'Playable clip',
          folderPath: 'Trips/2026',
          folderPathSegments: ['Trips', '2026'],
        } as never}
      />,
    )

    expect(markup).toContain('Trips/2026')
  })

  it('throws for unsupported media kinds', () => {
    expect(() =>
      renderToStaticMarkup(
        <MediaCard item={{ id: 'broken-1', kind: 'gif' as never, title: 'Broken item' }} />,
      ),
    ).toThrow('Unsupported media kind')
  })
})
