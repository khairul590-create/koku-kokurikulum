import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { z } from 'zod'
import { db } from './_lib/supabase'
import { crud } from './_lib/crud'
import {
  issueSession,
  clearSession,
  isAuthed,
  safeEqual,
} from './_lib/auth'
import { gradeFromTotal } from '../shared/types'

export const config = { runtime: 'edge' }

const app = new Hono().basePath('/api')

// No CORS middleware: the SPA and API are same-origin, so cross-origin requests
// are intentionally rejected by the browser. (Previously this reflected ANY
// origin with credentials — removed.)

// Never let sensitive API responses be cached by the browser/proxies.
app.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store, max-age=0')
})

app.onError((err, c) => {
  console.error(err) // full detail to logs only
  return c.json({ error: 'Ralat pelayan dalaman.' }, 500) // never leak internals
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

// ─────────────── AUTH ───────────────
// Best-effort per-instance login throttle (edge instances are ephemeral, so
// this is defense-in-depth, not a hard guarantee).
const loginHits = new Map<string, { n: number; first: number }>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_TRIES = 10

function clientIp(c: { req: { header: (k: string) => string | undefined } }) {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

app.post('/auth/login', async (c) => {
  const ip = clientIp(c)
  const now = Date.now()
  const rec = loginHits.get(ip)
  if (rec && now - rec.first < WINDOW_MS && rec.n >= MAX_TRIES)
    return c.json({ error: 'Terlalu banyak cubaan. Cuba lagi kemudian.' }, 429)

  const { password } = await c.req.json().catch(() => ({}))
  const expected = process.env.ADMIN_PASSWORD
  if (!expected)
    return c.json({ error: 'Sistem belum dikonfigur (ADMIN_PASSWORD).' }, 500)

  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    if (!rec || now - rec.first >= WINDOW_MS) loginHits.set(ip, { n: 1, first: now })
    else rec.n++
    return c.json({ error: 'Kata laluan salah' }, 401)
  }
  loginHits.delete(ip)
  await issueSession(c)
  return c.json({ ok: true })
})
app.post('/auth/logout', (c) => {
  clearSession(c)
  return c.json({ ok: true })
})
app.get('/auth/me', async (c) => c.json({ authed: await isAuthed(c) }))

// ─────────────── AUTH GUARD ───────────────
// Everything below requires a valid admin session (protects student PII reads
// too). Endpoints registered ABOVE this line stay public (auth/*). /health is
// allowlisted explicitly.
const PUBLIC_PATHS = new Set(['/api/health'])
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (PUBLIC_PATHS.has(path)) return next()
  if (await isAuthed(c)) return next()
  return c.json({ error: 'Perlu log masuk admin' }, 401)
})

// ─────────────── SCHEMAS ───────────────
const str = (max: number) => z.string().trim().max(max)
const optStr = (max: number) => z.string().trim().max(max).optional().nullable()
const dateStr = z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()

const unitSchema = z.object({
  name: str(120).min(1),
  kind: z.enum(['kelab', 'beruniform', 'sukan']),
  advisor: optStr(120),
})
const classSchema = z.object({
  name: str(80).min(1),
  tahun: z.coerce.number().int().min(1).max(6),
  guru_kelas: optStr(120),
})
const studentSchema = z.object({
  name: str(120).min(1),
  class_id: z.string().uuid().optional().nullable(),
  jantina: z.enum(['L', 'P']).optional().nullable(),
})
// Resolve class_id -> cache kelas name + tahun. Only touches those fields when
// class_id is part of the write (so partial updates don't clobber them).
async function studentTransform(b: Record<string, unknown>) {
  if (!('class_id' in b)) return b
  if (b.class_id) {
    const { data: cls } = await db()
      .from('classes')
      .select('name,tahun')
      .eq('id', b.class_id as string)
      .single()
    if (cls) return { ...b, kelas: cls.name, tahun: cls.tahun }
    return b
  }
  return { ...b, kelas: '' }
}
const bulkRowSchema = z.object({
  name: str(120).min(1),
  kelas: str(80).min(1),
  tahun: z.coerce.number().int().min(1).max(6).optional(),
  jantina: z.enum(['L', 'P']).optional().nullable(),
})
const enrollmentSchema = z.object({
  student_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  role: optStr(80),
  highest_level: z
    .enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'])
    .default('sekolah'),
})
const attendanceSchema = z.object({
  student_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  week: z.coerce.number().int().min(1).max(52),
  present: z.boolean(),
  session: str(20).default('2026'),
})
const pajskSchema = z.object({
  student_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  session: str(20).default('2026'),
  m_kehadiran: z.coerce.number().min(0).max(100).default(0),
  m_jawatan: z.coerce.number().min(0).max(100).default(0),
  m_penglibatan: z.coerce.number().min(0).max(100).default(0),
  m_pencapaian: z.coerce.number().min(0).max(100).default(0),
})
const achievementSchema = z.object({
  student_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  title: str(160).min(1),
  level: z
    .enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'])
    .default('sekolah'),
  position: optStr(80),
  date: dateStr,
})
const activitySchema = z.object({
  title: str(160).min(1),
  date: dateStr,
  unit_id: z.string().uuid().optional().nullable(),
  description: optStr(2000),
  status: str(40).default('dirancang'),
})

const stuSel = 'id,name,kelas,tahun,jantina'
const unitSel = 'id,name,kind,advisor'

// ─────────────── RESOURCE ROUTES ───────────────
app.route('/units', crud({
  table: 'units',
  schema: unitSchema,
  filters: ['kind'],
  order: { col: 'name' },
}))
app.route('/classes', crud({
  table: 'classes',
  schema: classSchema,
  filters: ['tahun'],
  order: { col: 'name' },
}))

// Bulk import — registered before the /students crud mount. Resolves/creates
// classes by name, then inserts students in chunks.
app.post('/students/bulk', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { rows?: unknown[] }
  const rows = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return c.json({ error: 'Tiada baris untuk import.' }, 400)
  if (rows.length > 2000)
    return c.json({ error: 'Maksimum 2000 baris setiap import.' }, 400)

  const sb = db()
  const { data: existing } = await sb.from('classes').select('id,name,tahun')
  const byName = new Map(
    (existing ?? []).map((c2) => [c2.name.toLowerCase(), c2]),
  )
  const errors: { row: number; error: string }[] = []
  const toInsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const parsed = bulkRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      errors.push({ row: i + 1, error: parsed.error.errors[0]?.message || 'tidak sah' })
      continue
    }
    const { name, kelas, tahun, jantina } = parsed.data
    let cls = byName.get(kelas.toLowerCase())
    if (!cls) {
      const { data: created, error } = await sb
        .from('classes')
        .insert({ name: kelas, tahun: tahun ?? 1 })
        .select('id,name,tahun')
        .single()
      if (error || !created) {
        errors.push({ row: i + 1, error: `gagal cipta kelas "${kelas}"` })
        continue
      }
      cls = created
      byName.set(kelas.toLowerCase(), cls)
    }
    toInsert.push({
      name,
      class_id: cls.id,
      kelas: cls.name,
      tahun: tahun ?? cls.tahun,
      jantina: jantina ?? null,
    })
  }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500)
    const { error } = await sb.from('students').insert(chunk)
    if (error) errors.push({ row: 0, error: error.message })
    else inserted += chunk.length
  }
  return c.json({
    inserted,
    skipped: rows.length - inserted,
    errors: errors.slice(0, 50),
  })
})

app.route('/students', crud({
  table: 'students',
  schema: studentSchema,
  select: 'id,name,class_id,kelas,tahun,jantina',
  filters: ['class_id', 'tahun'],
  searchCol: 'name',
  order: { col: 'name' },
  transform: studentTransform,
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
app.put('/settings', async (c) => {
  const text = await c.req.text()
  if (text.length > 50_000)
    return c.json({ error: 'Tetapan terlalu besar.' }, 413)
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    return c.json({ error: 'JSON tidak sah.' }, 400)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return c.json({ error: 'Format tetapan tidak sah.' }, 400)
  const { data, error } = await db()
    .from('settings')
    .update({ data: body })
    .eq('id', 1)
    .select('data')
    .single()
  if (error) return c.json({ error: 'Gagal simpan tetapan.' }, 400)
  return c.json(data.data)
})

// ─────────────── STATS (dashboard) ───────────────
// All aggregation done in Postgres via the dashboard_stats() RPC so the
// dashboard stays correct & fast at scale (no 1000-row PostgREST cap).
app.get('/stats', async (c) => {
  const { data, error } = await db().rpc('dashboard_stats')
  if (error) return c.json({ error: 'Gagal kira statistik.' }, 500)
  return c.json(data)
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
