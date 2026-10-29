-- Native D1/SQLite port. No business rows or settings seed: import the exact source data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('kelab','beruniform','sukan')),
  advisor TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_units_kind ON units(kind);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  name TEXT NOT NULL UNIQUE,
  tahun INTEGER NOT NULL DEFAULT 1,
  guru_kelas TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  name TEXT NOT NULL,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  kelas TEXT NOT NULL DEFAULT '',
  tahun INTEGER NOT NULL DEFAULT 4,
  jantina TEXT CHECK (jantina IN ('L','P')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_students_tahun ON students(tahun);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  role TEXT,
  highest_level TEXT NOT NULL DEFAULT 'sekolah' CHECK (highest_level IN ('sekolah','daerah','negeri','kebangsaan','antarabangsa')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id,unit_id)
);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_unit ON enrollments(unit_id);
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  week INTEGER NOT NULL DEFAULT 1,
  present INTEGER NOT NULL DEFAULT 1 CHECK (present IN (0,1)),
  session TEXT NOT NULL DEFAULT '2026',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id,unit_id,week,session)
);
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_att_unit ON attendance(unit_id);
CREATE TABLE IF NOT EXISTS pajsk_scores (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  session TEXT NOT NULL DEFAULT '2026',
  m_kehadiran REAL NOT NULL DEFAULT 0,
  m_jawatan REAL NOT NULL DEFAULT 0,
  m_penglibatan REAL NOT NULL DEFAULT 0,
  m_pencapaian REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'E' CHECK (grade IN ('A','B','C','D','E')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id,unit_id,session)
);
CREATE INDEX IF NOT EXISTS idx_pajsk_student ON pajsk_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_pajsk_session ON pajsk_scores(session);
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'sekolah' CHECK (level IN ('sekolah','daerah','negeri','kebangsaan','antarabangsa')),
  position TEXT,
  date TEXT CHECK (date IS NULL OR (date BETWEEN '0001-01-01' AND '9999-12-31' AND date(date,'+0 days') IS NOT NULL AND date = date(date,'+0 days'))),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',(random() & 3)+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  title TEXT NOT NULL,
  date TEXT CHECK (date IS NULL OR (date BETWEEN '0001-01-01' AND '9999-12-31' AND date(date,'+0 days') IS NOT NULL AND date = date(date,'+0 days'))),
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'dirancang',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_act_date ON activities(date);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data) AND json_type(data) = 'object')
);
CREATE TABLE IF NOT EXISTS login_throttles (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 1)
);
CREATE INDEX IF NOT EXISTS idx_login_window ON login_throttles(window_start);

-- One SQL snapshot over ALL rows, mirroring the Postgres dashboard_stats() contract.
CREATE VIEW IF NOT EXISTS dashboard_stats AS
WITH
  tot AS (SELECT
    (SELECT count(*) FROM students) AS students,
    (SELECT count(*) FROM units) AS units,
    (SELECT count(*) FROM achievements) AS achievements,
    (SELECT count(DISTINCT student_id) FROM enrollments) AS enrolled),
  att AS (SELECT count(*) FILTER (WHERE present = 1) AS p, count(*) AS t FROM attendance),
  pj AS (SELECT coalesce(round(avg(total),1),0) AS avg FROM pajsk_scores),
  unit_avg AS (
    SELECT u.id,u.name,u.kind,coalesce(round(avg(p.total),1),0) AS avg
    FROM units u LEFT JOIN pajsk_scores p ON p.unit_id = u.id GROUP BY u.id,u.name,u.kind),
  kinds(kind) AS (VALUES ('kelab'),('beruniform'),('sukan')),
  komp AS (SELECT k.kind,
    (SELECT count(*) FROM units u WHERE u.kind = k.kind) AS units,
    (SELECT count(DISTINCT e.student_id) FROM enrollments e JOIN units u ON u.id=e.unit_id WHERE u.kind=k.kind) AS students,
    coalesce((SELECT round(avg(p.total),1) FROM pajsk_scores p JOIN units u ON u.id=p.unit_id WHERE u.kind=k.kind),0) AS avg
    FROM kinds k),
  grade_values(grade) AS (VALUES ('A'),('B'),('C'),('D'),('E')),
  grades AS (SELECT g.grade,(SELECT count(*) FROM pajsk_scores p WHERE p.grade=g.grade) AS count FROM grade_values g),
  best_level AS (SELECT student_id,max(CASE highest_level WHEN 'sekolah' THEN 0 WHEN 'daerah' THEN 1 WHEN 'negeri' THEN 2 WHEN 'kebangsaan' THEN 3 WHEN 'antarabangsa' THEN 4 END) AS lvl FROM enrollments GROUP BY student_id),
  level_values(level,idx) AS (VALUES ('sekolah',0),('daerah',1),('negeri',2),('kebangsaan',3),('antarabangsa',4)),
  levels AS (SELECT l.level,l.idx,(SELECT count(*) FROM best_level b WHERE b.lvl=l.idx) AS count FROM level_values l),
  stu_avg AS (SELECT student_id,avg(total) AS avg FROM pajsk_scores GROUP BY student_id),
  top AS (SELECT s.name,s.kelas,round(sa.avg,1) AS total,
    CASE WHEN sa.avg>=80 THEN 'A' WHEN sa.avg>=60 THEN 'B' WHEN sa.avg>=40 THEN 'C' WHEN sa.avg>=20 THEN 'D' ELSE 'E' END AS grade
    FROM stu_avg sa JOIN students s ON s.id=sa.student_id ORDER BY sa.avg DESC LIMIT 5),
  att_ratio AS (SELECT student_id,unit_id,count(*) FILTER (WHERE present=1) AS p,count(*) AS t,
    1.0 * count(*) FILTER (WHERE present=1) / nullif(count(*),0) AS pct FROM attendance GROUP BY student_id,unit_id),
  low AS (SELECT s.name,u.name AS unit,r.p AS present,r.t AS total,r.pct FROM att_ratio r
    JOIN students s ON s.id=r.student_id JOIN units u ON u.id=r.unit_id WHERE r.t>=3 AND r.pct<0.6 ORDER BY r.pct ASC LIMIT 5),
  acts AS (SELECT title,date,status FROM activities ORDER BY date DESC NULLS LAST LIMIT 5)
SELECT json_object(
  'totalStudents',(SELECT students FROM tot),
  'totalUnits',(SELECT units FROM tot),
  'totalAchievements',(SELECT achievements FROM tot),
  'participationPct',CASE WHEN (SELECT students FROM tot)>0 THEN round((SELECT enrolled FROM tot)*100.0/(SELECT students FROM tot),1) ELSE 0 END,
  'avgPajsk',(SELECT avg FROM pj),
  'attendancePct',CASE WHEN (SELECT t FROM att)>0 THEN round((SELECT p FROM att)*100.0/(SELECT t FROM att),1) ELSE 0 END,
  'komponen',json((SELECT json_group_array(json_object('kind',kind,'units',units,'students',students,'avg',avg)) FROM komp)),
  'unitAverages',json((SELECT json_group_array(json_object('name',name,'kind',kind,'avg',avg)) FROM (SELECT * FROM unit_avg ORDER BY avg DESC))),
  'gradeDist',json((SELECT json_group_array(json_object('grade',grade,'count',count)) FROM grades)),
  'levelDist',json((SELECT json_group_array(json_object('level',level,'count',count)) FROM (SELECT * FROM levels ORDER BY idx))),
  'topStudents',json((SELECT json_group_array(json_object('name',name,'kelas',kelas,'total',total,'grade',grade)) FROM (SELECT * FROM top ORDER BY total DESC))),
  'lowAttendance',json((SELECT json_group_array(json_object('name',name,'unit',unit,'present',present,'total',total)) FROM (SELECT * FROM low ORDER BY pct ASC))),
  'recentActivities',json((SELECT json_group_array(json_object('title',title,'date',date,'status',status)) FROM acts))
) AS data;
