-- Sistem Pengurusan Kokurikulum SK Darau — Postgres schema (Supabase)
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- The API uses the service-role key, so Row Level Security is left disabled;
-- all access is gated by the single-admin auth middleware in the API layer.

create extension if not exists "pgcrypto";

-- ── UNITS (kelab / beruniform / sukan) ──
create table if not exists units (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('kelab','beruniform','sukan')),
  advisor     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_units_kind on units(kind);

-- ── STUDENTS (murid) ──
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kelas       text not null,
  tahun       int  not null default 4,
  created_at  timestamptz not null default now()
);
create index if not exists idx_students_tahun on students(tahun);

-- ── ENROLLMENTS (penyertaan murid dlm unit) ──
create table if not exists enrollments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  unit_id       uuid not null references units(id) on delete cascade,
  role          text,
  highest_level text not null default 'sekolah'
                check (highest_level in ('sekolah','daerah','negeri','kebangsaan','antarabangsa')),
  created_at    timestamptz not null default now(),
  unique (student_id, unit_id)
);
create index if not exists idx_enroll_student on enrollments(student_id);
create index if not exists idx_enroll_unit on enrollments(unit_id);

-- ── ATTENDANCE (kehadiran) ──
create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  unit_id     uuid not null references units(id) on delete cascade,
  week        int  not null default 1,
  present     boolean not null default true,
  session     text not null default '2026',
  created_at  timestamptz not null default now(),
  unique (student_id, unit_id, week, session)
);
create index if not exists idx_att_student on attendance(student_id);
create index if not exists idx_att_unit on attendance(unit_id);

-- ── PAJSK SCORES (markah) ──
create table if not exists pajsk_scores (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  unit_id       uuid not null references units(id) on delete cascade,
  session       text not null default '2026',
  m_kehadiran   numeric not null default 0,  -- /50 (suggested)
  m_jawatan     numeric not null default 0,  -- /10
  m_penglibatan numeric not null default 0,  -- /20
  m_pencapaian  numeric not null default 0,  -- /20
  total         numeric not null default 0,
  grade         text not null default 'E' check (grade in ('A','B','C','D','E')),
  created_at    timestamptz not null default now(),
  unique (student_id, unit_id, session)
);
create index if not exists idx_pajsk_student on pajsk_scores(student_id);
create index if not exists idx_pajsk_session on pajsk_scores(session);

-- ── ACHIEVEMENTS (pencapaian & anugerah) ──
create table if not exists achievements (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) on delete cascade,
  unit_id     uuid references units(id) on delete set null,
  title       text not null,
  level       text not null default 'sekolah'
              check (level in ('sekolah','daerah','negeri','kebangsaan','antarabangsa')),
  position    text,
  date        date,
  created_at  timestamptz not null default now()
);

-- ── ACTIVITIES (takwim) ──
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  date        date,
  unit_id     uuid references units(id) on delete set null,
  description text,
  status      text not null default 'dirancang',
  created_at  timestamptz not null default now()
);
create index if not exists idx_act_date on activities(date);

-- ── SETTINGS (singleton key/value JSON) ──
create table if not exists settings (
  id    int primary key default 1,
  data  jsonb not null default '{}'::jsonb,
  check (id = 1)
);
insert into settings (id, data) values (1, '{"school":"SK Darau","session":"2026"}')
  on conflict (id) do nothing;

-- ── ROW LEVEL SECURITY ──
-- Enable RLS on every table with NO policies. The service-role key (used by the
-- API) bypasses RLS, so the app keeps working; the anon/public key gets ZERO
-- access. This makes the public anon key safe even if it leaks, and blocks any
-- direct PostgREST access that bypasses the API auth layer.
alter table units         enable row level security;
alter table students      enable row level security;
alter table enrollments   enable row level security;
alter table attendance    enable row level security;
alter table pajsk_scores  enable row level security;
alter table achievements  enable row level security;
alter table activities    enable row level security;
alter table settings      enable row level security;
