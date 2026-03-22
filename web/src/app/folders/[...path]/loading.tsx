import { Skeleton } from '@/components/ui/skeleton'

export default function FolderLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
