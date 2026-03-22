import Link from 'next/link'
import type { Folder } from '@/lib/supabase/types'
import { Card } from '@/components/ui/card'

export function FolderCard({ folder }: { folder: Folder }) {
  const href = `/folders/${folder.path}`

  return (
    <Link href={href}>
      <Card className="group flex items-center gap-3 p-4 hover:ring-2 hover:ring-primary transition-all">
        <span className="text-2xl">📁</span>
        <span className="text-sm font-medium truncate">{folder.name}</span>
      </Card>
    </Link>
  )
}
