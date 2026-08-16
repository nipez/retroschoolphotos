// Shared helpers for the internal analytics pipeline.
// Files under functions/_lib are not routed by Cloudflare Pages (leading _),
// so they are safe to import from the actual route handlers.

export const EVENT_TYPES = ['pageview', 'mode_select', 'upload', 'generate', 'download', 'gif', 'share'];
export const MODES = ['solo', 'class', 'pet', 'super'];

// Create the events table + indexes if they do not exist yet. Cheap and
// idempotent, so route handlers can call it on every request. This keeps local
// dev zero-setup and makes production self-healing if a migration was missed.
export async function ensureSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       ts INTEGER NOT NULL,
       day TEXT NOT NULL,
       type TEXT NOT NULL,
       mode TEXT,
       path TEXT,
       referrer TEXT,
       referrer_host TEXT,
       utm_source TEXT,
       device TEXT,
       country TEXT,
       session TEXT
     )`
  ).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_day ON events(day)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_session ON events(session)`).run();
}

export function reportsKey(env) {
  return (env && env.REPORTS_KEY) || 'retro-preview-stats';
}

export function deviceType(ua = '') {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Hostname of a referrer URL. Returns '' for direct / missing / same-site-only
// values so the dashboard can bucket them as "direct".
export function hostOf(referrer = '') {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function dayOf(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}
