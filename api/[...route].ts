import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'
import { z } from 'zod'
import { db } from './_lib/supabase'
import { crud } from './_lib/crud'
import { issueSession, clearSession, isAuthed, requireAuth } from './_lib/auth'
import { gradeFromTotal } from '../shared/types'

export const config = { runtime: 'edge' }

const app = new Hono().basePath('/api')

app.use('*', cors({ origin: (o) => o, credentials: true }))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'Ralat pelayan' }, 500)
})

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404))

// ─────────────── AUTH ───────────────
app.post('/auth/login', async (c) => {
  const { password } = await c.req.json().catch(() => ({}))
  const expected = process.env.ADMIN_PASSWORD || 'admin123'
  if (!password || password !== expected)
    return c.json({ error: 'Kata laluan salah' }, 401)
  await issueSession(c)
  return c.json({ ok: true })
})
app.post('/auth/logout', (c) => {
  clearSession(c)
  return c.json({ ok: true })
})
app.get('/auth/me', async (c) => c.json({ authed: await isAuthed(c) }))

// ─────────────── SCHEMAS ───────────────
const unitSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['kelab', 'beruniform', 'sukan']),
  advisor: z.string().optional().nullable(),
})
const studentSchema = z.object({
  name: z.string().min(1),
  kelas: z.string().min(1),
  tahun: z.coerce.number().int().min(1).max(6),
})
const enrollmentSchema = z.object({
  student_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  role: z.string().optional().nullable(),
  highest_level: z
    .enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'])
    .default('sekolah'),
})
const attendanceSchema = z.object({
  student_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  week: z.coerce.number().int().min(1).max(52),
  present: z.coerce.boolean(),
  session: z.string().default('2026'),
})
const pajskSchema = z.object({
  student_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  session: z.string().default('2026'),
  m_kehadiran: z.coerce.number().min(0).default(0),
  m_jawatan: z.coerce.number().min(0).default(0),
  m_penglibatan: z.coerce.number().min(0).default(0),
  m_pencapaian: z.coerce.number().min(0).default(0),
})
const achievementSchema = z.object({
  student_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  level: z
    .enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'])
    .default('sekolah'),
  position: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
})
const activitySchema = z.object({
  title: z.string().min(1),
  date: z.string().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().default('dirancang'),
})

const stuSel = 'id,name,kelas,tahun'
const unitSel = 'id,name,kind,advisor'

// ─────────────── RESOURCE ROUTES ───────────────
app.route('/units', crud({
  table: 'units',
  schema: unitSchema,
  filters: ['kind'],
  order: { col: 'name' },
}))
app.route('/students', crud({
  table: 'students',
  schema: studentSchema,
  filters: ['tahun'],
  order: { col: 'name' },
}))
app.route('/enrollments', crud({
  table: 'enrollments',
  schema: enrollmentSchema,
  filters: ['student_id', 'unit_id'],
  select: `*, student:students(${stuSel}), unit:units(${unitSel})`,
  order: { col: 'created_at', asc: false },
}))
app.route('/attendance', crud({
  table: 'attendance',
  schema: attendanceSchema,
  filters: ['student_id', 'unit_id', 'session', 'week'],
  select: `*, student:students(${stuSel}), unit:units(${unitSel})`,
  order: { col: 'week' },
}))
app.route('/pajsk-scores', crud({
  table: 'pajsk_scores',
  schema: pajskSchema,
  filters: ['student_id', 'unit_id', 'session'],
  select: `*, student:students(${stuSel}), unit:units(${unitSel})`,
  order: { col: 'total', asc: false },
  transform: (b) => {
    const total =
      Number(b.m_kehadiran || 0) +
      Number(b.m_jawatan || 0) +
      Number(b.m_penglibatan || 0) +
      Number(b.m_pencapaian || 0)
    return { ...b, total, grade: gradeFromTotal(total) }
  },
}))
app.route('/achievements', crud({
  table: 'achievements',
  schema: achievementSchema,
  filters: ['student_id', 'unit_id', 'level'],
  select: `*, student:students(${stuSel}), unit:units(${unitSel})`,
  order: { col: 'date', asc: false },
}))
app.route('/activities', crud({
  table: 'activities',
  schema: activitySchema,
  filters: ['unit_id', 'status'],
  select: `*, unit:units(${unitSel})`,
  order: { col: 'date', asc: false },
}))

// ─────────────── SETTINGS ───────────────
app.get('/settings', async (c) => {
  const { data } = await db().from('settings').select('data').eq('id', 1).single()
  return c.json(data?.data ?? {})
})
app.put('/settings', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { data, error } = await db()
    .from('settings')
    .update({ data: body })
    .eq('id', 1)
    .select('data')
    .single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data.data)
})

// ─────────────── STATS (dashboard) ───────────────
app.get('/stats', async (c) => {
  const sb = db()
  const [students, units, enroll, scores, att, ach, acts] = await Promise.all([
    sb.from('students').select('id,name,kelas,tahun'),
    sb.from('units').select('id,name,kind'),
    sb.from('enrollments').select('student_id,unit_id,highest_level'),
    sb.from('pajsk_scores').select('student_id,unit_id,total,grade'),
    sb.from('attendance').select('present'),
    sb.from('achievements').select('id'),
    sb.from('activities').select('title,date,status').order('date', { ascending: false }).limit(5),
  ])

  const S = students.data ?? []
  const U = units.data ?? []
  const E = enroll.data ?? []
  const SC = scores.data ?? []
  const AT = att.data ?? []
  const ACH = ach.data ?? []
  const ACT = acts.data ?? []

  const totalStudents = S.length
  const totalUnits = U.length
  const enrolledStudents = new Set(E.map((e) => e.student_id)).size
  const participationPct = totalStudents
    ? Math.round((enrolledStudents / totalStudents) * 1000) / 10
    : 0
  const avgPajsk = SC.length
    ? Math.round((SC.reduce((s, x) => s + Number(x.total), 0) / SC.length) * 10) / 10
    : 0
  const attendancePct = AT.length
    ? Math.round((AT.filter((a) => a.present).length / AT.length) * 1000) / 10
    : 0

  const unitById = new Map(U.map((u) => [u.id, u]))
  // per-unit average + per-kind aggregate
  const unitTotals = new Map<string, { sum: number; n: number }>()
  for (const s of SC) {
    const t = unitTotals.get(s.unit_id) ?? { sum: 0, n: 0 }
    t.sum += Number(s.total)
    t.n += 1
    unitTotals.set(s.unit_id, t)
  }
  const unitAverages = U.map((u) => {
    const t = unitTotals.get(u.id)
    return {
      name: u.name,
      kind: u.kind,
      avg: t && t.n ? Math.round((t.sum / t.n) * 10) / 10 : 0,
    }
  }).sort((a, b) => b.avg - a.avg)

  const kinds = ['kelab', 'beruniform', 'sukan'] as const
  const komponen = kinds.map((kind) => {
    const unitIds = U.filter((u) => u.kind === kind).map((u) => u.id)
    const idset = new Set(unitIds)
    const studs = new Set(E.filter((e) => idset.has(e.unit_id)).map((e) => e.student_id))
    const sc = SC.filter((s) => idset.has(s.unit_id))
    const avg = sc.length
      ? Math.round((sc.reduce((a, x) => a + Number(x.total), 0) / sc.length) * 10) / 10
      : 0
    return { kind, units: unitIds.length, students: studs.size, avg }
  })

  const grades = ['A', 'B', 'C', 'D', 'E'] as const
  const gradeDist = grades.map((grade) => ({
    grade,
    count: SC.filter((s) => s.grade === grade).length,
  }))

  const levels = ['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'] as const
  // highest level achieved per student
  const rank = (l: string) => levels.indexOf(l as never)
  const bestLevel = new Map<string, string>()
  for (const e of E) {
    const cur = bestLevel.get(e.student_id)
    if (!cur || rank(e.highest_level) > rank(cur))
      bestLevel.set(e.student_id, e.highest_level)
  }
  const levelDist = levels.map((level) => ({
    level,
    count: [...bestLevel.values()].filter((l) => l === level).length,
  }))

  // top students by average score
  const stuTotals = new Map<string, { sum: number; n: number; best: string }>()
  for (const s of SC) {
    const t = stuTotals.get(s.student_id) ?? { sum: 0, n: 0, best: 'E' }
    t.sum += Number(s.total)
    t.n += 1
    stuTotals.set(s.student_id, t)
  }
  const stuById = new Map(S.map((s) => [s.id, s]))
  const topStudents = [...stuTotals.entries()]
    .map(([id, t]) => {
      const avg = t.sum / t.n
      const st = stuById.get(id)
      return {
        name: st?.name ?? '—',
        kelas: st?.kelas ?? '',
        total: Math.round(avg * 10) / 10,
        grade: gradeFromTotal(avg),
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // low attendance: present ratio per (student,unit) — handled via separate query
  const { data: attRows } = await sb
    .from('attendance')
    .select('student_id,unit_id,present')
  const ratio = new Map<string, { p: number; n: number }>()
  for (const a of attRows ?? []) {
    const k = `${a.student_id}|${a.unit_id}`
    const r = ratio.get(k) ?? { p: 0, n: 0 }
    if (a.present) r.p += 1
    r.n += 1
    ratio.set(k, r)
  }
  const lowAttendance = [...ratio.entries()]
    .map(([k, r]) => {
      const [sid, uid] = k.split('|')
      return {
        name: stuById.get(sid)?.name ?? '—',
        unit: unitById.get(uid)?.name ?? '—',
        present: r.p,
        total: r.n,
        pct: r.p / r.n,
      }
    })
    .filter((x) => x.total >= 3 && x.pct < 0.6)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
    .map(({ name, unit, present, total }) => ({ name, unit, present, total }))

  return c.json({
    totalStudents,
    totalUnits,
    participationPct,
    avgPajsk,
    totalAchievements: ACH.length,
    attendancePct,
    komponen,
    unitAverages,
    gradeDist,
    levelDist,
    topStudents,
    lowAttendance,
    recentActivities: ACT.map((a) => ({
      title: a.title,
      date: a.date,
      status: a.status,
    })),
  })
})

// ─────────────── REPORTS ───────────────
app.get('/reports/student/:id', async (c) => {
  const sb = db()
  const id = c.req.param('id')
  const [student, enroll, scores, ach, att] = await Promise.all([
    sb.from('students').select('*').eq('id', id).single(),
    sb.from('enrollments').select(`*, unit:units(${unitSel})`).eq('student_id', id),
    sb.from('pajsk_scores').select(`*, unit:units(${unitSel})`).eq('student_id', id),
    sb.from('achievements').select(`*, unit:units(${unitSel})`).eq('student_id', id),
    sb.from('attendance').select('unit_id,present').eq('student_id', id),
  ])
  if (student.error) return c.json({ error: 'Murid tidak dijumpai' }, 404)
  const attByUnit = new Map<string, { p: number; n: number }>()
  for (const a of att.data ?? []) {
    const r = attByUnit.get(a.unit_id) ?? { p: 0, n: 0 }
    if (a.present) r.p += 1
    r.n += 1
    attByUnit.set(a.unit_id, r)
  }
  return c.json({
    student: student.data,
    enrollments: enroll.data ?? [],
    scores: scores.data ?? [],
    achievements: ach.data ?? [],
    attendance: [...attByUnit.entries()].map(([unit_id, r]) => ({
      unit_id,
      present: r.p,
      total: r.n,
    })),
  })
})

app.get('/reports/unit/:id', async (c) => {
  const sb = db()
  const id = c.req.param('id')
  const [unit, enroll, scores, att] = await Promise.all([
    sb.from('units').select('*').eq('id', id).single(),
    sb.from('enrollments').select(`*, student:students(${stuSel})`).eq('unit_id', id),
    sb.from('pajsk_scores').select('total').eq('unit_id', id),
    sb.from('attendance').select('present').eq('unit_id', id),
  ])
  if (unit.error) return c.json({ error: 'Unit tidak dijumpai' }, 404)
  const sc = scores.data ?? []
  const at = att.data ?? []
  return c.json({
    unit: unit.data,
    members: enroll.data ?? [],
    avgScore: sc.length
      ? Math.round((sc.reduce((a, x) => a + Number(x.total), 0) / sc.length) * 10) / 10
      : 0,
    attendancePct: at.length
      ? Math.round((at.filter((a) => a.present).length / at.length) * 1000) / 10
      : 0,
  })
})

app.get('/health', (c) => c.json({ ok: true }))

export default handle(app)
