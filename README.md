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

## Deploy

Git-connected Cloudflare Pages. Build command can stay empty; output directory is `.` (see `pages_build_output_dir` in `wrangler.toml`).

Pages Functions live under `functions/` and provide:

- `POST /api/yearbook` — opt-in upload of a web-size retro JPEG only
- `GET /api/yearbook` — list recent public shares
- `GET /api/yearbook/:id` — fetch a shared JPEG

## Public yearbook (opt-in)

Off by default. After generate (solo or pet), the user can tap **Add to the public yearbook**. That uploads only the generated retro result (~800×1000 JPEG, max ~1.2MB), never the original upload, mask, or print/Stories exports. Class / superlatives modes do not offer yearbook share in v1.

### Cloudflare bindings Nicholas must configure

R2 was not enabled on the account at implement time (`Please enable R2 through the Cloudflare Dashboard`), so v1 stores images + a short index in **Workers KV**.

1. **KV (already created for this PR)**
   - Namespace title: `retro-yearbook`
   - Binding name in Functions / `wrangler.toml`: `YEARBOOK`
   - Namespace id: `9f761ebb0f7a464dbc09afb97011f2fe`
   - In Pages: **Settings → Bindings → Add → KV namespace** → variable `YEARBOOK` → select `retro-yearbook`, then redeploy. If the project uses `wrangler.toml` from git, the binding is already declared.

2. **R2 (preferred later, optional)**
   - Enable R2 in the Cloudflare Dashboard.
   - Create a bucket named `retro-yearbook`.
   - Bind it as `YEARBOOK_R2` (uncomment the `[[r2_buckets]]` block in `wrangler.toml`, or add the binding in Pages settings).
   - When `YEARBOOK_R2` is present, Functions store JPEG bytes in R2 and keep the index/meta in KV. Keep the `YEARBOOK` KV binding either way.

Do **not** put yearbook images on the hit-counter Worker (`laser-counter.nickperez.workers.dev`).

## Notes

- Main UI: `index.html`. Public grid: `yearbook.html` (served as `/yearbook`).
- Fonts, MediaPipe, and gif.js load from CDNs.
- Hit counter: `https://laser-counter.nickperez.workers.dev` (`COUNTER_API` near the top of the script).
- `COFFEE_URL` is empty.
