import Image from 'next/image'
import Link from 'next/link'
import type { Media } from '@/lib/supabase/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDuration, formatSize } from '@/lib/format'

export function MediaCard({ item }: { item: Media }) {
  const href = item.type === 'video' ? `/watch/${item.id}` : `/photo/${item.id}`
  const duration = formatDuration(item.duration)
  const size = formatSize(item.size)

  return (
    <Link href={href}>
      <Card className="group overflow-hidden hover:ring-2 hover:ring-primary transition-all">
        <div className="relative aspect-video bg-muted">
          {item.thumbnail_url ? (
            <Image
              src={item.thumbnail_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No preview
            </div>
          )}
          {duration && (
            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {duration}
            </span>
          )}
          <Badge variant="secondary" className="absolute top-1 left-1 text-xs">
            {item.type}
          </Badge>
        </div>
        <div className="p-2">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {size && <p className="text-xs text-muted-foreground">{size}</p>}
        </div>
      </Card>
    </Link>
  )
}
