-- Internal analytics event store for Retro School Photos.
-- The Pages Functions also create this table on demand (CREATE TABLE IF NOT
-- EXISTS), so applying this file is optional but recommended for production.

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,          -- event time, unix ms
  day           TEXT    NOT NULL,          -- YYYY-MM-DD (UTC), for grouping
  type          TEXT    NOT NULL,          -- pageview | mode_select | upload | generate | download | gif | share
  mode          TEXT,                      -- solo | class | pet | super
  path          TEXT,
  referrer      TEXT,
  referrer_host TEXT,                       -- '' means direct / none
  utm_source    TEXT,
  device        TEXT,                       -- mobile | tablet | desktop
  country       TEXT,
  session       TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_day     ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session);
