# Drive Media Library Design

## Goal

Build a private website for a friend group to browse and watch media from one shared Google Drive root folder with many nested folders. The main value over Google Drive is a better viewing experience, especially when Drive preview fails or is slow for some video files.

## Product Shape

- Private media library, not a social network
- One shared password for V1 access
- Mixed experience: video feed plus photo gallery
- Google Drive remains the source of truth and storage layer
- No database in V1; use a generated metadata cache file instead
- Auto organization only from existing metadata such as filename, modified date, media type, and folder path
- Nested folders are secondary context, not the main navigation

## Media Assumptions

- Most videos are `mp4`, and most are already playable in Google Drive
- The main problem is the subset of videos that fail Drive preview with the "taking longer than expected to process" message
- Photos are mostly standard Android `jpeg` and iPhone `heic`
- `cr2` RAW photos are the main non-web-standard image type, but Google Drive preview is available for them

These assumptions make a free-first approach viable because the app does not need full transcoding or mirrored storage for most files.

## Architecture

### Frontend

Use a Next.js app for:

- shared-password entry gate
- home feed/gallery
- video watch pages
- photo lightbox or detail pages
- simple search and filters

### Backend

Use lightweight server routes or a small backend layer for:

- scanning the Google Drive root folder recursively
- normalizing file metadata
- streaming supported video files from Drive through the app when needed
- exposing clean APIs to the frontend

### Cache Instead of Database

V1 stores indexed metadata in a generated JSON file such as `media-index.json`.

Each entry should include:

- Drive file id
- file name
- MIME type
- extension
- size
- modified time
- thumbnail link if available
- full nested folder path
- media kind: photo or video
- playback classification

This avoids database cost while still keeping the site fast.

## Playback Strategy

### Videos

Use this order:

1. Direct browser playback through the app's own stream endpoint for browser-friendly files, mainly `mp4`
2. Google Drive preview fallback when direct playback is not practical
3. Direct download fallback when a file is not web-playable or playback still fails

The stream endpoint should support byte-range requests so users can seek inside videos.

This is the key design choice: the site should not depend only on Drive preview. If Drive preview is stuck, the app can still try to serve the original file for browser playback.

### Photos

- Standard web images such as `jpeg` render directly in the gallery and detail views
- `heic` may not work consistently across browsers, so treat it as best-effort display with download fallback if needed
- `cr2` should be classified as Drive-preview-only in V1, with download also available

## User Experience

### Home

The home page shows a unified library with tabs or filters for:

- All
- Videos
- Photos

Videos use larger cards with thumbnail, duration when available, modified date, and folder context.

Photos use a denser grid for quick scanning.

### Detail Pages

Video pages include:

- player
- title
- folder path
- modified date
- nearby or related items from the same folder or time window

Photo pages or lightbox include:

- full-size preview when supported
- left/right navigation
- download button
- folder context

### Discovery

V1 discovery comes only from inferred metadata:

- latest uploads
- media type
- file name search
- folder path filter
- modified date

No manual tags, playlists, likes, or comments.

## Folder Handling

The Drive root folder is the single library source. The app scans all nested folders recursively.

Folders are shown as secondary context, for example `Trips/Japan/Day 3`, and users can optionally click that path to filter the library. Folder structure is useful metadata, but the main browsing mode remains the mixed feed/gallery.

## Error Handling

Each media item should be classified into one of these states:

- `playable_in_browser`
- `preview_only`
- `download_only`

For videos, the UI should say clearly what happened instead of showing a vague failure state. If playback fails, show a helpful message and the next available action.

Examples:

- playable `mp4`: show native player
- broken Drive preview but browser-playable original: stream through app
- unsupported video or image format: show download option
- `cr2`: use Drive preview/open action rather than native in-site rendering

## Operations

Use a scheduled sync job to:

- rescan the Drive tree
- update the metadata cache
- avoid reprocessing unchanged files when possible

For V1, a periodic full or semi-incremental sync is acceptable.

## Constraints And Risks

- Keeping Drive as the only storage keeps costs low
- Proxy streaming avoids mirrored storage but may still consume hosting bandwidth
- Fully serverless hosting may be a bad fit for large or frequent video streaming
- `heic` browser support varies by platform and browser
- `cr2` is not a realistic target for native in-site rendering in a free V1, even though Drive preview can still be used

## Recommended V1 Stack

- Next.js
- Google Drive API
- simple server-side password gate
- scheduled sync script
- JSON metadata cache

## Out Of Scope For V1

- social features
- Google login
- transcoding pipeline
- mirrored object storage
- favorites or watch history
- manual tags
- RAW image processing beyond Drive preview

## Success Criteria

V1 is successful if the group can:

- browse one shared Drive library more pleasantly than in Drive
- play most `mp4` videos without depending only on Drive preview
- view standard photos quickly
- view `cr2` files through Drive preview when needed, with download as fallback
- discover content easily through recent uploads, media type, and folder context
