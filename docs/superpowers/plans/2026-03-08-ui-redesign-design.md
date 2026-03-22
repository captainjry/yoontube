# Yoontube UI Redesign Design

## Goal

Redesign the whole Yoontube web UI so it feels modern and minimal while staying warm, editorial, and media-first rather than dashboard-heavy.

## Product Context

- Yoontube is a private Google Drive media library, not a social feed.
- The best version of the UI makes browsing feel calmer and more premium than Google Drive.
- Folder paths remain secondary context, not the primary navigation model.
- The current backend-driven flows should stay intact: login gate, library filters, photo detail pages, video detail pages, and Drive fallback states.

## Visual Direction

Use an editorial gallery style:

- warm neutral background with subtle gradient depth
- dark ink typography instead of stark black
- restrained stone/olive accent tones
- soft layered surfaces instead of loud borders
- composed spacing and typography doing most of the visual work

This should feel minimal through restraint, not emptiness.

## Experience Principles

- Keep the interface clean, but not generic.
- Let media titles and viewing surfaces dominate the hierarchy.
- Use a single shared visual system across login, library, photo, and video pages.
- Use motion sparingly: page reveal, hover lift, and focus transitions only.
- Preserve mobile quality instead of treating it as a scaled-down desktop layout.

## Structural Changes

### Global shell

Move styling responsibility into the app shell and a shared stylesheet so pages stop relying on isolated inline styles. The root layout should define tokens for color, type, spacing, radii, shadows, and base element styles.

### Library page

The home page should become a composed gallery view with:

- a strong editorial hero header
- concise descriptive copy
- small stats or status metadata
- polished filter pills
- a responsive media grid with more intentional card hierarchy

### Media cards

Cards should feel like curated media covers instead of raw metadata boxes. Each card should include a media label, stronger title treatment, quieter folder path display, and a visual placeholder surface that makes the grid feel designed even without thumbnails.

### Login page

The login route should feel like an entry screen to the same product, with a centered branded card, a quieter message, and a more considered form treatment.

### Detail pages

Photo and video pages should share a common header and framing system:

- back link
- media type label
- large title
- quiet metadata block
- framed viewer/player area
- graceful fallback action card for preview/download states

## Constraints

- Do not change backend APIs or authentication flow.
- Do not introduce unnecessary dependencies for styling.
- Keep the pages server-rendered and compatible with the existing tests.
- Prefer shared UI patterns over one-off page styling.

## Success Criteria

The redesign is successful when:

- the app feels visually cohesive across all routes
- the library looks premium and easy to scan on desktop and mobile
- the login page no longer feels like a placeholder
- photo and video detail pages feel deliberate and polished
- existing data and playback flows continue to work unchanged
