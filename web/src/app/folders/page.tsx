import { listFolders } from '@/lib/queries'
import { FolderCard } from '@/components/folder-card'

export default async function FoldersPage() {
  const folders = await listFolders(null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Folders</h1>
      {folders.length === 0 ? (
        <p className="text-muted-foreground">No folders found. Run a sync to populate.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}
        </div>
      )}
    </div>
  )
}
