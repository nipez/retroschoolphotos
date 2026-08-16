# Retro School Photos

Static single-page app. All HTML, CSS, and JS live in `index.html`. Photo generation runs entirely in the browser. There is no backend, no build step, no package.json, no automated tests, and no linter.

## Cursor Cloud specific instructions

- Serving: this is a single static `index.html`. Run a static server from the repo root. Zero-dependency option: `python3 -m http.server 8000` (Python 3 is preinstalled). The README's documented option is `npx --yes serve .` (the update script preinstalls `serve` globally so this is fast). Then open the served URL (e.g. `http://localhost:8000/`).
- There is nothing to build, lint, or unit-test. "Running the app" == serving the static file and exercising it in a browser.
- Network egress is required at runtime for the core feature: the browser loads MediaPipe (`selfie_segmentation`, `face_detection`) and `gif.js` from `cdn.jsdelivr.net`, and fonts from `fonts.googleapis.com`. If photo generation hangs, first check CDN reachability.
- Core flow to smoke-test ("hello world"): upload a portrait photo into the `#photo-input` upload zone, then click the enabled `Generate Now` button (`#generate-btn`) → a generated retro school photo appears in the result section.
- Test images: use a real face photo for meaningful results (face detection/segmentation runs on it). `https://randomuser.me/api/portraits/men/32.jpg` works from this environment; `upload.wikimedia.org` blocks non-browser requests (returns an HTML error page), so avoid it for fetching test images via curl.
- Config knobs near the top of the inline script: `COUNTER_API` (hit-counter Worker URL) and `COFFEE_URL` (empty). These are optional and not needed to run.
