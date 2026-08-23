# Retro School Photos

Static single-page app for [retroschoolphotos.com](https://retroschoolphotos.com). Recovered from the live Cloudflare Pages deploy (`retrophotosv1`, zip upload, deployment `65b60bc0`).

## Run locally

Open `index.html` in a browser, or:

```bash
npx --yes serve .
```

To also run the internal analytics backend (`/api/track` + `/reports`) locally you need the Cloudflare Pages dev server instead of a plain static server:

```bash
npm install
npm run dev            # wrangler pages dev + local D1 on http://localhost:8788
npm run seed           # optional: populate ~30 days of demo data
# open http://localhost:8788/reports?key=retro-preview-stats
```

The plain static server (`npx serve` / `python3 -m http.server`) still works for the photo app itself — the tracking beacons just no-op without the Functions backend.

## Internal analytics

Lightweight, self-hosted analytics for the preview funnel (no third-party tracker):

- **Client** (`index.html`): a fire-and-forget `navigator.sendBeacon` sends `pageview`, `mode_select`, `upload`, `generate`, `download`, and `gif` events to `/api/track`.
- **Ingest** (`functions/api/track.js`): inserts events into a Cloudflare D1 table (`events`). Schema is created on demand, and `schema.sql` is provided for explicit migration.
- **Dashboard** (`functions/reports.js`): server-rendered insights at `/reports?key=…`, gated by the `REPORTS_KEY` var. Shows KPIs, the visit→upload→generate→download funnel, top pages, UTM sources, per-day pageviews/visitors, generations by mode, devices, and top referrers.

Production setup:

1. `wrangler d1 create retro_analytics` and paste the id into `wrangler.toml`.
2. `wrangler pages secret put REPORTS_KEY` (choose a private key; the default in `wrangler.toml` is for local dev only).
3. Optionally `npm run db:init:remote` to apply `schema.sql`, then deploy.

## Deploy

This is a static Pages project. Connect this repo to Cloudflare Pages, or upload the folder. Build command can stay empty; output directory is `.` (Pages auto-detects the `functions/` directory for the analytics endpoints.)

## Notes

- The photo app lives entirely in `index.html` (HTML, CSS, JS). Fonts, MediaPipe, and gif.js load from CDNs; generation runs in the browser.
- The `functions/` directory + `wrangler.toml` + `schema.sql` add the internal analytics backend (Pages Functions + D1). These are additive and don't change the photo app.
- Hit counter: `https://laser-counter.nickperez.workers.dev` (`COUNTER_API` near the top of the script).
- `COFFEE_URL` is empty.
- The original zip also had a `__MACOSX` junk file. Left that out.
