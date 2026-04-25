-- supabase/migrations/001_initial_schema.sql

-- Extensions
create extension if not exists pg_trgm with schema extensions;

-- Folders table
create table folders (
  id text primary key,              -- Google Drive folder ID
  name text not null,
  parent_id text references folders(id) on delete cascade,
  path text not null,               -- e.g. "Trips/Japan 2024"
  synced_at timestamptz not null default now()
);

create index idx_folders_parent_id on folders(parent_id);

-- Media table
create table media (
  id text primary key,              -- Google Drive file ID
  name text not null,
  folder_id text references folders(id) on delete set null,
  mime_type text not null,
  type text not null check (type in ('video', 'photo')),
  size bigint,
  thumbnail_url text,
  duration integer,                 -- milliseconds, null if unavailable
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index idx_media_folder_id on media(folder_id);
create index idx_media_type on media(type);
create index idx_media_name on media(name);
create index idx_media_created_at on media(created_at desc);

-- Full-text search on media name
create index idx_media_name_trgm on media using gin (name extensions.gin_trgm_ops);
