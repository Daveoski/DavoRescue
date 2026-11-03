-- DavoRescue schema. Idempotent: safe to run on every deploy.

create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  phone            text not null unique,
  email            text unique,
  password_hash    text not null,
  role             text not null default 'citizen' check (role in ('citizen', 'responder', 'admin')),
  agency_slug      text,
  alert_radius_km  integer not null default 15 check (alert_radius_km between 1 and 200),
  last_lat         double precision,
  last_lng         double precision,
  last_located_at  timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists agencies (
  slug         text primary key,
  name         text not null,
  short_name   text not null,
  kind         text not null check (kind in ('police', 'fire', 'ambulance', 'frsc', 'nema', 'security', 'hotline')),
  categories   text[] not null,
  state        text not null,
  phones       text[] not null default '{}',
  sms_phones   text[] not null default '{}',
  emails       text[] not null default '{}',
  address      text,
  source_url   text,
  source_note  text,
  verified_on  date,
  priority     integer not null default 50,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table if not exists incidents (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique,
  category              text not null check (category in ('crime', 'fire', 'medical', 'road', 'disaster')),
  subtype               text not null,
  description           text not null,
  injured_count         integer,
  lat                   double precision not null,
  lng                   double precision not null,
  accuracy_m            double precision,
  road_name             text,
  road_class            text,
  navigability          text not null default 'unknown',
  access_lat            double precision,
  access_lng            double precision,
  access_distance_m     double precision,
  address               text,
  lga                   text,
  state                 text not null default 'enugu',
  reporter_id           uuid references users(id) on delete set null,
  is_anonymous          boolean not null default true,
  reporter_contact      text,
  reporter_fingerprint  text,
  status                text not null default 'received'
                        check (status in ('received', 'verified', 'rejected', 'dispatched', 'responding', 'resolved')),
  verdict               text check (verdict in ('true', 'false')),
  verification_source   text check (verification_source in ('ai', 'rules', 'human')),
  confidence            real,
  severity              smallint,
  panic_score           smallint,
  ai_summary            text,
  ai_reasons            jsonb not null default '[]',
  ai_red_flags          jsonb not null default '[]',
  evidence_match        text,
  public_alert          text,
  dispatch_message      text,
  reporter_advice       text,
  corroboration_count   integer not null default 0,
  created_at            timestamptz not null default now(),
  verified_at           timestamptz,
  resolved_at           timestamptz,
  updated_at            timestamptz not null default now()
);

create index if not exists incidents_created_idx on incidents (created_at desc);
create index if not exists incidents_geo_idx on incidents (lat, lng);
create index if not exists incidents_status_idx on incidents (status, created_at desc);
create index if not exists incidents_fingerprint_idx on incidents (reporter_fingerprint, created_at desc);

create table if not exists incident_media (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references incidents(id) on delete cascade,
  mime          text not null,
  bytes         bytea not null,
  sha256        text not null,
  captured_at   timestamptz,
  capture_lat   double precision,
  capture_lng   double precision,
  live_capture  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists incident_media_incident_idx on incident_media (incident_id);

create table if not exists dispatches (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references incidents(id) on delete cascade,
  agency_slug  text references agencies(slug) on delete set null,
  channel      text not null check (channel in ('email', 'sms', 'webhook', 'push')),
  target       text not null,
  status       text not null check (status in ('sent', 'failed', 'skipped')),
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists dispatches_incident_idx on dispatches (incident_id);

create table if not exists incident_events (
  id           bigserial primary key,
  incident_id  uuid not null references incidents(id) on delete cascade,
  actor_id     uuid references users(id) on delete set null,
  kind         text not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists incident_events_incident_idx on incident_events (incident_id, created_at);

create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- Road Watch: ~4 km stretches of Enugu's major roads (seeded from roadwatch/corridors.json)
create table if not exists road_segments (
  id             text primary key,
  corridor_id    text not null,
  corridor_name  text not null,
  ref            text,
  seq            integer not null,
  label          text not null,
  lga            text,
  length_m       integer not null,
  path           jsonb not null,
  min_lat        double precision not null,
  max_lat        double precision not null,
  min_lng        double precision not null,
  max_lng        double precision not null
);

-- Satellite review of a stretch. Incident risk is computed live when read, so it never goes stale.
create table if not exists road_assessments (
  id              bigserial primary key,
  segment_id      text not null references road_segments(id) on delete cascade,
  scanned_at      timestamptz not null default now(),
  method          text not null check (method in ('ai', 'imagery')),
  exposure_risk   smallint not null,
  physical_risk   smallint not null,
  vegetation_pct  smallint,
  surface         text,
  settlement      text,
  hazards         jsonb not null default '[]',
  summary         text not null,
  advice          text,
  confidence      real,
  model           text,
  imagery_date    date,
  imagery_res_m   real
);

create index if not exists road_assessments_segment_idx on road_assessments (segment_id, scanned_at desc);

-- Road pulse: drivers' check-ins and early warning signs. Signals that agree are grouped into a cluster.
create table if not exists road_signals (
  id                    uuid primary key default gen_random_uuid(),
  cluster_id            uuid not null,
  kind                  text not null check (kind in ('warning', 'turning_back', 'all_clear')),
  sign                  text,
  note                  text,
  lat                   double precision not null,
  lng                   double precision not null,
  accuracy_m            double precision,
  segment_id            text references road_segments(id) on delete set null,
  reporter_id           uuid references users(id) on delete set null,
  reporter_fingerprint  text not null,
  status                text not null default 'unverified'
                        check (status in ('unverified', 'corroborated', 'confirmed', 'dismissed')),
  reviewed_by           uuid references users(id) on delete set null,
  incident_id           uuid references incidents(id) on delete set null,
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null
);

create index if not exists road_signals_recent_idx on road_signals (created_at desc);
create index if not exists road_signals_cluster_idx on road_signals (cluster_id);
create index if not exists road_signals_geo_idx on road_signals (lat, lng);

-- Trip guardian: a traveller's expected arrival, watched on their behalf.
create table if not exists trips (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  share_token        text not null unique,
  destination        text not null,
  eta                timestamptz not null,
  contacts           jsonb not null default '[]',
  status             text not null default 'active' check (status in ('active', 'arrived', 'cancelled')),
  last_lat           double precision,
  last_lng           double precision,
  last_seen_at       timestamptz,
  reminded_at        timestamptz,
  overdue_alerted_at timestamptz,
  alert_log          jsonb not null default '[]',
  created_at         timestamptz not null default now(),
  ended_at           timestamptz
);

create index if not exists trips_active_idx on trips (status, eta);
