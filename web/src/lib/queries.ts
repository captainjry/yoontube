// src/lib/queries.ts
import { createClient } from '@/lib/supabase/server'
import { ITEMS_PER_PAGE } from '@/lib/constants'
import type { SortOption } from '@/components/sort-select'
import type { MediaFilter } from '@/components/filter-tabs'
import type { Folder, Media } from '@/lib/supabase/types'

type ListMediaParams = {
  filter?: MediaFilter
  sort?: SortOption
  page?: number
  folderId?: string | null
  search?: string
}

export async function listMedia({ filter, sort = 'date', page = 1, folderId, search }: ListMediaParams) {
  const supabase = await createClient()
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE

  let query = supabase.from('media').select('*', { count: 'exact' })

  if (filter === 'videos') query = query.eq('type', 'video')
  if (filter === 'photos') query = query.eq('type', 'photo')

  if (folderId !== undefined) {
    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  if (sort === 'name') query = query.order('name', { ascending: true })
  else if (sort === 'size') query = query.order('size', { ascending: false, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  query = query.range(from, to - 1)

  const { data, count, error } = await query

  if (error) throw error

  return {
    items: (data ?? []) as Media[],
    total: count ?? 0,
    hasMore: (count ?? 0) > to,
    nextPage: page + 1,
  }
}

export type MediaWithFolder = {
  id: string
  name: string
  folder_id: string | null
  mime_type: string
  type: 'video' | 'photo'
  size: number | null
  thumbnail_url: string | null
  duration: number | null
  created_at: string
  synced_at: string
  folders: { name: string; path: string } | null
}

export async function getMediaById(id: string): Promise<MediaWithFolder> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media')
    .select('*, folders(name, path)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as MediaWithFolder
}

export async function listFolders(parentId: string | null): Promise<Folder[]> {
  const supabase = await createClient()

  let query = supabase.from('folders').select('*').order('name')

  if (parentId) {
    query = query.eq('parent_id', parentId)
  } else {
    query = query.is('parent_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Folder[]
}

export async function getFolderByPath(pathSegments: string[]): Promise<Folder | null> {
  const supabase = await createClient()
  const path = pathSegments.join('/')

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('path', path)
    .single()

  if (error) return null
  return data as Folder
}

export async function getSyncStatus() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('media')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as { synced_at: string } | null)?.synced_at ?? null
}
