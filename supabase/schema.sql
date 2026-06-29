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

-- ── CLASSES (kelas) ──
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tahun       int  not null default 1,
  guru_kelas  text,
  created_at  timestamptz not null default now()
);

-- ── STUDENTS (murid) ──
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  class_id    uuid references classes(id) on delete set null,
  kelas       text not null default '',   -- cache nama kelas utk paparan
  tahun       int  not null default 4,
  jantina     text check (jantina in ('L','P')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_students_tahun on students(tahun);
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_name on students(name);

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
alter table classes       enable row level security;
alter table students      enable row level security;
alter table enrollments   enable row level security;
alter table attendance    enable row level security;
alter table pajsk_scores  enable row level security;
alter table achievements  enable row level security;
alter table activities    enable row level security;
alter table settings      enable row level security;

-- ── DASHBOARD AGGREGATES (see migration_003_stats.sql) ──
-- /api/stats calls this RPC so the dashboard never pulls all rows (1000 cap).
create or replace function dashboard_stats()
returns jsonb language sql stable as $$
with
  tot as (
    select
      (select count(*) from students)                       as students,
      (select count(*) from units)                          as units,
      (select count(*) from achievements)                   as achievements,
      (select count(distinct student_id) from enrollments)  as enrolled
  ),
  att as (select count(*) filter (where present) as p, count(*) as t from attendance),
  pj  as (select coalesce(round(avg(total)::numeric, 1), 0) as avg from pajsk_scores),
  unit_avg as (
    select u.id, u.name, u.kind, coalesce(round(avg(p.total)::numeric, 1), 0) as avg
    from units u left join pajsk_scores p on p.unit_id = u.id
    group by u.id, u.name, u.kind
  ),
  komp as (
    select k.kind,
      (select count(*) from units u where u.kind = k.kind) as units,
      (select count(distinct e.student_id) from enrollments e
         join units u on u.id = e.unit_id where u.kind = k.kind) as students,
      coalesce((select round(avg(p.total)::numeric, 1) from pajsk_scores p
         join units u on u.id = p.unit_id where u.kind = k.kind), 0) as avg
    from (values ('kelab'), ('beruniform'), ('sukan')) k(kind)
  ),
  grades as (
    select g.grade, coalesce((select count(*) from pajsk_scores p where p.grade = g.grade), 0) as count
    from (values ('A'), ('B'), ('C'), ('D'), ('E')) g(grade)
  ),
  best_level as (
    select student_id, max(case highest_level
      when 'sekolah' then 0 when 'daerah' then 1 when 'negeri' then 2
      when 'kebangsaan' then 3 when 'antarabangsa' then 4 end) as lvl
    from enrollments group by student_id
  ),
  levels as (
    select l.level, l.idx, coalesce((select count(*) from best_level b where b.lvl = l.idx), 0) as count
    from (values ('sekolah',0),('daerah',1),('negeri',2),('kebangsaan',3),('antarabangsa',4)) l(level, idx)
  ),
  stu_avg as (select student_id, avg(total) as avg from pajsk_scores group by student_id),
  top as (
    select s.name, s.kelas, round(sa.avg::numeric, 1) as total,
      case when sa.avg >= 80 then 'A' when sa.avg >= 60 then 'B'
           when sa.avg >= 40 then 'C' when sa.avg >= 20 then 'D' else 'E' end as grade
    from stu_avg sa join students s on s.id = sa.student_id
    order by sa.avg desc limit 5
  ),
  att_ratio as (
    select a.student_id, a.unit_id, count(*) filter (where present) as p, count(*) as t,
      count(*) filter (where present)::numeric / nullif(count(*), 0) as pct
    from attendance a group by a.student_id, a.unit_id
  ),
  low as (
    select s.name, u.name as unit, r.p as present, r.t as total, r.pct
    from att_ratio r join students s on s.id = r.student_id join units u on u.id = r.unit_id
    where r.t >= 3 and r.pct < 0.6
    order by r.pct asc limit 5
  ),
  acts as (select title, date, status from activities order by date desc nulls last limit 5)
select jsonb_build_object(
  'totalStudents', (select students from tot),
  'totalUnits', (select units from tot),
  'totalAchievements', (select achievements from tot),
  'participationPct', case when (select students from tot) > 0
     then round((select enrolled from tot)::numeric * 100 / (select students from tot), 1) else 0 end,
  'avgPajsk', (select avg from pj),
  'attendancePct', case when (select t from att) > 0
     then round((select p from att)::numeric * 100 / (select t from att), 1) else 0 end,
  'komponen', (select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'units',units,'students',students,'avg',avg)), '[]') from komp),
  'unitAverages', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'kind',kind,'avg',avg) order by avg desc), '[]') from unit_avg),
  'gradeDist', (select coalesce(jsonb_agg(jsonb_build_object('grade',grade,'count',count)), '[]') from grades),
  'levelDist', (select coalesce(jsonb_agg(jsonb_build_object('level',level,'count',count) order by idx), '[]') from levels),
  'topStudents', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'kelas',kelas,'total',total,'grade',grade) order by total desc), '[]') from top),
  'lowAttendance', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'unit',unit,'present',present,'total',total) order by pct asc), '[]') from low),
  'recentActivities', (select coalesce(jsonb_agg(jsonb_build_object('title',title,'date',date,'status',status)), '[]') from acts)
);
$$;
