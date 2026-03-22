// src/lib/supabase/types.ts
export type Database = {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          path: string
          synced_at: string
        }
        Insert: {
          id: string
          name: string
          parent_id?: string | null
          path: string
          synced_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          synced_at?: string
        }
      }
      media: {
        Row: {
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
        }
        Insert: {
          id: string
          name: string
          folder_id?: string | null
          mime_type: string
          type: 'video' | 'photo'
          size?: number | null
          thumbnail_url?: string | null
          duration?: number | null
          created_at?: string
          synced_at?: string
        }
        Update: {
          id?: string
          name?: string
          folder_id?: string | null
          mime_type?: string
          type?: 'video' | 'photo'
          size?: number | null
          thumbnail_url?: string | null
          duration?: number | null
          created_at?: string
          synced_at?: string
        }
      }
    }
  }
}

export type Folder = Database['public']['Tables']['folders']['Row']
export type Media = Database['public']['Tables']['media']['Row']
