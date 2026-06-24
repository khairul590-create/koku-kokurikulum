-- Migration 002: Kelas terurus + medan murid (class_id, jantina)
-- Jalankan dalam Supabase → SQL Editor. Selamat dijalankan sekali (idempotent).

create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tahun       int  not null default 1,
  guru_kelas  text,
  created_at  timestamptz not null default now()
);
alter table classes enable row level security;

alter table students add column if not exists class_id uuid references classes(id) on delete set null;
alter table students add column if not exists jantina text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_jantina_chk') then
    alter table students add constraint students_jantina_chk check (jantina in ('L','P'));
  end if;
end $$;
-- 'kelas' kekal sebagai cache paparan; benarkan kosong
alter table students alter column kelas set default '';

create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_name on students(name);
