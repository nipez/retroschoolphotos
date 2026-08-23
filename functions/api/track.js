// POST /api/track — records a single analytics event into D1.
// Called from the browser via navigator.sendBeacon / fetch(keepalive).
// Body: { type, mode?, path?, referrer?, utm_source?, device?, session?, ts?, key? }
// ts/key are only honored together (for seeding/backfill) and gated by REPORTS_KEY.

import { ensureSchema, reportsKey, deviceType, hostOf, dayOf } from '../_lib/analytics.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env && env.DB;
  if (!db) return new Response('analytics store not configured', { status: 503, headers: CORS });

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  await ensureSchema(db);

  const now = Date.now();
  let ts = now;
  // Allow explicit timestamps only when a valid key is supplied (backfill/seed).
  if (body.ts && body.key && String(body.key) === reportsKey(env)) {
    const parsed = Number(body.ts);
    if (Number.isFinite(parsed)) ts = parsed;
  }

  const clamp = (v, n) => (v == null ? null : String(v).slice(0, n));

  const type = (clamp(body.type, 32) || 'pageview').toLowerCase();
  const mode = body.mode ? clamp(body.mode, 16) : null;
  const path = clamp(body.path, 256) || '/';
  const referrer = clamp(body.referrer, 512) || '';
  const referrerHost = hostOf(referrer);
  const utmSource = body.utm_source ? clamp(body.utm_source, 64) : null;
  const ua = request.headers.get('user-agent') || '';
  const device = clamp(body.device, 16) || deviceType(ua);
  const country = (request.cf && request.cf.country) || null;
  const session = body.session ? clamp(body.session, 64) : null;
  const day = dayOf(ts);

  await db
    .prepare(
      `INSERT INTO events (ts, day, type, mode, path, referrer, referrer_host, utm_source, device, country, session)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(ts, day, type, mode, path, referrer, referrerHost, utmSource, device, country, session)
    .run();

  return new Response(null, { status: 204, headers: CORS });
}
