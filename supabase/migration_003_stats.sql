-- Migration 003: dashboard_stats() RPC — server-side aggregates so the dashboard
-- is correct & fast at scale (1200+ students) instead of pulling all rows (which
-- hit the PostgREST 1000-row cap). Run in Supabase → SQL Editor.

create or replace function dashboard_stats()
returns jsonb
language sql
stable
as $$
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
    select u.id, u.name, u.kind,
           coalesce(round(avg(p.total)::numeric, 1), 0) as avg
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
    select g.grade,
      coalesce((select count(*) from pajsk_scores p where p.grade = g.grade), 0) as count
    from (values ('A'), ('B'), ('C'), ('D'), ('E')) g(grade)
  ),
  best_level as (
    select student_id, max(case highest_level
      when 'sekolah' then 0 when 'daerah' then 1 when 'negeri' then 2
      when 'kebangsaan' then 3 when 'antarabangsa' then 4 end) as lvl
    from enrollments group by student_id
  ),
  levels as (
    select l.level, l.idx,
      coalesce((select count(*) from best_level b where b.lvl = l.idx), 0) as count
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
    select a.student_id, a.unit_id,
      count(*) filter (where present) as p, count(*) as t,
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
