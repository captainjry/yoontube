# Yoontube

Yoontube is a private Drive media library with a Next.js frontend on Vercel and a Fastify backend on an Oracle VM. The web app proxies browser playback requests through Next route handlers, while the backend serves auth, media metadata, and stream endpoints backed by a JSON index generated from Google Drive.

## Architecture

- `web/` is the user-facing Next.js app.
- `backend/` is the Fastify service that reads `backend/data/media-index.json` and talks to Google Drive.
- A scheduled sync job refreshes the backend media index by running `npm run sync` on the Oracle host.

## Backend deployment on Oracle VM

1. Copy the repo to `/opt/yoontube` on the VM and install dependencies with `npm install`.
2. Create `backend/.env` from `backend/.env.example` and set the Drive credentials, root folder id, shared password, and `PORT`.
3. Start the backend with PM2 from `backend/` using `pm2 start ecosystem.config.cjs`.
4. Put Nginx or another reverse proxy in front of the backend and expose only the proxy publicly.

The PM2 config in `backend/ecosystem.config.cjs` assumes the backend lives at `/opt/yoontube/backend` and starts it with `npm run start`.

## Sync cron job

Use the wrapper script as the canonical cron entrypoint on the Oracle host:

```cron
*/15 * * * * /opt/yoontube/backend/scripts/run-sync-cron.sh >> /var/log/yoontube-sync.log 2>&1
```

`backend/scripts/run-sync-cron.sh` changes into the backend directory, adds common system Node paths for cron, attempts to load `nvm` from `~/.nvm` if needed, and then runs `npm run sync`.

## Web deployment on Vercel

1. Create a Vercel project rooted at `web/`.
2. Set `BACKEND_BASE_URL` to the public Oracle VM proxy origin, for example `https://media.example.com`, not an internal hostname.
3. Verify that URL before or after deploy with `curl "$BACKEND_BASE_URL/health"` and confirm the backend responds successfully.
4. Deploy normally with the Next.js defaults from `web/vercel.json`.

The frontend keeps auth and media requests inside the Next app, then proxies backend stream access through `web/src/app/api/stream/[id]/route.ts`.

## Verification Checklist

- Confirm signing in with the wrong password returns `401`.
- Confirm signing in with the right password opens the library.
- Confirm nested folders show the expected folder context/path in the library UI.
- Confirm `mp4` playback can seek correctly in the browser.
- Confirm browser-playable photos render in the photo view.
- Confirm `cr2` files open through the Drive preview fallback.
- Confirm `heic` files use the fallback behavior.
- Confirm the sync job regenerates `backend/data/media-index.json`.
