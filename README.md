# Retro School Photos

Static single-page app for [retroschoolphotos.com](https://retroschoolphotos.com). Recovered from the live Cloudflare Pages deploy (`retrophotosv1`, zip upload, deployment `65b60bc0`).

## Run locally

Open `index.html` in a browser, or:

```bash
npx --yes serve .
```

## Deploy

This is a static Pages project. Connect this repo to Cloudflare Pages, or upload the folder. Build command can stay empty; output directory is `.`

## Notes

- Everything lives in `index.html` (HTML, CSS, JS). Fonts, MediaPipe, and gif.js load from CDNs.
- Photo generation runs in the browser. No Pages Functions, no env vars.
- Hit counter: `https://laser-counter.nickperez.workers.dev` (`COUNTER_API` near the top of the script).
- `COFFEE_URL` is empty.
- The original zip also had a `__MACOSX` junk file. Left that out.
