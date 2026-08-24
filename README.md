# Retro School Photos

Static single-page app for [retroschoolphotos.com](https://retroschoolphotos.com). Cloudflare Pages project: `retrophotosv1` (repo `nipez/retroschoolphotos`).

## Run locally

Open `index.html` in a browser, or:

```bash
npx --yes serve .
# or
python3 -m http.server 8000
```

Static preview serves the UI only. Yearbook API routes need Pages Functions (see below).

```bash
npx wrangler pages dev . --port 8788
```

Local R2 uses the `YEARBOOK` binding from `wrangler.toml` (simulated locally unless you set remote bindings).

## Deploy

Git-connected Cloudflare Pages. Build command can stay empty; output directory is `.` (see `pages_build_output_dir` in `wrangler.toml`).

Pages Functions live under `functions/` and provide:

- `POST /api/yearbook` — opt-in upload of a web-size retro JPEG only
- `GET /api/yearbook` — list recent public shares
- `GET /api/yearbook/:id` — fetch a shared JPEG (proxied from private R2)

## Public yearbook (opt-in)

Off by default. After generate (solo or pet), the user can tap **Add to the public yearbook**. That uploads only the generated retro result (~800×1000 JPEG, max ~1.2MB), never the original upload, mask, or print/Stories exports. Class / superlatives modes do not offer yearbook share in v1.

### Cloudflare bindings Nicholas must configure

Storage is **R2 only** (no KV). Bucket is private; images are never exposed via a public `r2.dev` URL.

1. **R2 bucket** (already created)
   - Name: `retro-yearbook`
   - Public access: disabled
2. **Binding** (in `wrangler.toml` and/or Pages → Settings → Bindings)
   - Variable name: `YEARBOOK` (also accepts `RETRO_YEARBOOK` in code)
   - R2 bucket: `retro-yearbook`
3. Redeploy Pages after binding so Functions see `env.YEARBOOK`.

Do **not** put yearbook images on the hit-counter Worker (`laser-counter.nickperez.workers.dev`).

## Notes

- Main UI: `index.html`. Public grid: `yearbook.html` (served as `/yearbook`).
- Fonts, MediaPipe, and gif.js load from CDNs.
- Hit counter: `https://laser-counter.nickperez.workers.dev` (`COUNTER_API` near the top of the script).
- `COFFEE_URL` is empty.
