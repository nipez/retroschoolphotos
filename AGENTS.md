# Retro School Photos

Static single-page photo app (`index.html`, all HTML/CSS/JS inline, generation runs in the browser) plus an additive internal analytics backend (Cloudflare Pages Functions in `functions/` + a D1 database). There is no bundler build step and no automated test suite or linter.

## Cursor Cloud specific instructions

- Serving: this is a single static `index.html`. Run a static server from the repo root. Zero-dependency option: `python3 -m http.server 8000` (Python 3 is preinstalled). The README's documented option is `npx --yes serve .` (the update script preinstalls `serve` globally so this is fast). Then open the served URL (e.g. `http://localhost:8000/`).
- There is nothing to build, lint, or unit-test. "Running the app" == serving the static file and exercising it in a browser.
- Network egress is required at runtime for the core feature: the browser loads MediaPipe (`selfie_segmentation`, `face_detection`) and `gif.js` from `cdn.jsdelivr.net`, and fonts from `fonts.googleapis.com`. If photo generation hangs, first check CDN reachability.
- Core flow to smoke-test ("hello world"): upload a portrait photo into the `#photo-input` upload zone, then click the enabled `Generate Now` button (`#generate-btn`) → a generated retro school photo appears in the result section.
- Test images: use a real face photo for meaningful results (face detection/segmentation runs on it). `https://randomuser.me/api/portraits/men/32.jpg` works from this environment; `upload.wikimedia.org` blocks non-browser requests (returns an HTML error page), so avoid it for fetching test images via curl.
- Config knobs near the top of the inline script: `COUNTER_API` (hit-counter Worker URL) and `COFFEE_URL` (empty). These are optional and not needed to run.

### Internal analytics (`functions/` + D1)

- The photo app and analytics are decoupled: serving `index.html` statically is enough to exercise photo generation. The client tracking beacon posts to `/api/track` and silently no-ops when that endpoint isn't present, so a plain static server never breaks.
- To run/test the analytics endpoints you need the Pages Functions runtime, not a static server: `npm run dev` (== `npx wrangler pages dev . --d1 DB=retro_analytics --port 8788`). Dashboard is `http://localhost:8788/reports?key=retro-preview-stats`; ingest is `POST /api/track`.
- The D1 schema is auto-created by the Functions (`CREATE TABLE IF NOT EXISTS`), so no migration step is needed for local dev. Local D1 data lives under `.wrangler/state` (gitignored) and is ephemeral — a fresh clone starts empty. Use `npm run seed` (dev server must be running) to populate ~30 days of demo data.
- `/reports` is gated by the `REPORTS_KEY` var (default `retro-preview-stats` for local dev, set via `wrangler.toml [vars]`; override in prod with `wrangler pages secret put REPORTS_KEY`). `/api/track` also accepts a `ts` timestamp override only when the matching `key` is supplied (used by the seed script for backdated data).
