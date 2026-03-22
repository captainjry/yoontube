import type { Media } from '@/lib/supabase/types'
import { MediaCard } from './media-card'
import { LoadMoreButton } from './load-more-button'

type MediaGridProps = {
  items: Media[]
  hasMore: boolean
  nextPage: number
}

export function MediaGrid({ items, hasMore, nextPage }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No media found
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center py-8">
          <LoadMoreButton nextPage={nextPage} />
        </div>
      )}
    </div>
  )
}
