import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { gradeFromTotal } from '../shared/types'

// Structural bindings keep the Worker independently typecheckable without workers-types.
type Row = Record<string, unknown>
type Value = string | number | null
export interface D1Result<T = Row> { results: T[]; success: boolean; meta: { changes?: number } }
export interface D1Statement {
  bind(...values: Value[]): D1Statement
  first<T = Row>(): Promise<T | null>
  all<T = Row>(): Promise<D1Result<T>>
  run<T = Row>(): Promise<D1Result<T>>
}
export interface D1Binding {
  prepare(sql: string): D1Statement
  batch<T = Row>(statements: D1Statement[]): Promise<D1Result<T>[]>
}
export interface Env {
  DB: D1Binding
  ADMIN_PASSWORD: string
  JWT_SECRET: string
  BUCKET?: { get(key: string): Promise<unknown> }
  ASSETS?: { fetch(request: Request): Promise<Response> }
}
type AppEnv = { Bindings: Env }
type Ctx = Context<AppEnv>
const app = new Hono<AppEnv>().basePath('/api')
const error = { error: 'Ralat pelayan dalaman.' }

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store, max-age=0')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('Origin')
    const site = c.req.header('Sec-Fetch-Site')
    if (origin !== new URL(c.req.url).origin || (site !== undefined && site !== 'same-origin'))
      return c.json({ error: 'Permintaan mesti dari origin yang sama.' }, 403)
  }
  await next()
})
app.onError((_err, c) => c.json(error, 500))
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.get('/', (c) => c.json({ error: 'Not found' }, 404))

function stmt(db: D1Binding, sql: string, values: unknown[] = []) {
  return db.prepare(sql).bind(...values.map((v): Value => {
    if (typeof v === 'boolean') return Number(v)
    if (v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) return v
    throw new Error('Invalid SQL value')
  }))
}
function dbError(e: unknown) {
  const message = e instanceof Error ? e.message : ''
  if (/UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(message)) return 'Rekod ini sudah wujud (pendua).'
  if (/FOREIGN KEY constraint failed/i.test(message)) return 'Rujukan tidak sah — rekod berkaitan tidak wujud atau telah dipadam.'
  return 'Gagal simpan rekod.'
}
function zerr(e: z.ZodError) {
  return e.errors.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')
}
function sessionCookie(c: Ctx) {
  const url = new URL(c.req.url)
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  return { name: local ? 'koku_session' : '__Host-koku_session', secure: !local }
}
function secret(c: Ctx) {
  if (!c.env.JWT_SECRET) throw new Error('Missing JWT_SECRET')
  return new TextEncoder().encode(c.env.JWT_SECRET)
}
async function isAuthed(c: Ctx) {
  const token = getCookie(c, sessionCookie(c).name)
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, secret(c), { algorithms: ['HS256'], issuer: 'koku', audience: 'koku-admin' })
    return payload.role === 'admin' && typeof payload.exp === 'number'
  } catch { return false }
}
async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}
async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([digest(a), digest(b)])
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}
app.post('/auth/login', async (c) => {
  if (!c.env.ADMIN_PASSWORD) return c.json({ error: 'Sistem belum dikonfigur (ADMIN_PASSWORD).' }, 500)
  if (!c.env.JWT_SECRET) return c.json(error, 500)
  const now = Date.now()
  const key = [...await digest(c.req.header('cf-connecting-ip') || 'unknown')].map((b) => b.toString(16).padStart(2, '0')).join('')
  // Reserve before checking the password: concurrent failures cannot race past the cap.
  const attempts = await c.env.DB.batch([
    stmt(c.env.DB, 'DELETE FROM login_throttles WHERE window_start <= ?', [now - 600000]),
    stmt(c.env.DB, `INSERT INTO login_throttles(key,window_start,attempts) VALUES(?1,?2,1)
      ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 WHERE attempts<10 RETURNING attempts`, [key, now]),
  ])
  if (!attempts[1].results.length) return c.json({ error: 'Terlalu banyak cubaan. Cuba lagi kemudian.' }, 429)
  const body: unknown = await c.req.json().catch(() => ({}))
  const password = body && typeof body === 'object' && 'password' in body ? body.password : undefined
  if (typeof password !== 'string' || !await safeEqual(password, c.env.ADMIN_PASSWORD))
    return c.json({ error: 'Kata laluan salah' }, 401)
  const token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setIssuer('koku').setAudience('koku-admin').setExpirationTime('2d').sign(secret(c))
  await stmt(c.env.DB, 'DELETE FROM login_throttles WHERE key = ?', [key]).run()
  const cookie = sessionCookie(c)
  setCookie(c, cookie.name, token, { httpOnly: true, secure: cookie.secure, sameSite: 'Strict', path: '/', maxAge: 172800 })
  return c.json({ ok: true })
})
app.post('/auth/logout', (c) => {
  const cookie = sessionCookie(c)
  setCookie(c, cookie.name, '', { httpOnly: true, secure: cookie.secure, sameSite: 'Strict', path: '/', maxAge: 0 })
  return c.json({ ok: true })
})
app.get('/auth/me', async (c) => c.json({ authed: await isAuthed(c) }))
app.get('/health', (c) => c.json({ ok: true }))
app.use('*', async (c, next) => {
  if (!await isAuthed(c)) return c.json({ error: 'Perlu log masuk admin' }, 401)
  await next()
})

const str = (max: number) => z.string().trim().max(max)
const optStr = (max: number) => str(max).optional().nullable()
const dateStr = z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
// Exact length also rejects the trailing newline accepted by Zod's UUID regex.
const uuid = z.string().length(36).uuid().transform((value) => value.toLowerCase())
const level = z.enum(['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'])
const classSchema = z.object({ name: str(80).min(1), tahun: z.coerce.number().int().min(1).max(6), guru_kelas: optStr(120) })
const studentSchema = z.object({ name: str(120).min(1), class_id: uuid.optional().nullable(), jantina: z.enum(['L', 'P']).optional().nullable() })
const bulkRowSchema = z.object({ name: str(120).min(1), kelas: str(80).min(1), tahun: z.coerce.number().int().min(1).max(6).optional(), jantina: z.enum(['L', 'P']).optional().nullable() })
const marks = ['m_kehadiran', 'm_jawatan', 'm_penglibatan', 'm_pencapaian'] as const
const resources = {
  units: { table: 'units', schema: z.object({ name: str(120).min(1), kind: z.enum(['kelab', 'beruniform', 'sukan']), advisor: optStr(120) }), filters: ['kind'], order: 'name' },
  classes: { table: 'classes', schema: classSchema, filters: ['tahun'], order: 'name' },
  students: { table: 'students', schema: studentSchema, filters: ['class_id', 'tahun'], order: 'name', search: 'name' },
  enrollments: { table: 'enrollments', schema: z.object({ student_id: uuid, unit_id: uuid, role: optStr(80), highest_level: level.default('sekolah') }), filters: ['student_id', 'unit_id'], order: 'created_at', desc: true, student: true, unit: true },
  attendance: { table: 'attendance', schema: z.object({ student_id: uuid, unit_id: uuid, week: z.coerce.number().int().min(1).max(52), present: z.boolean(), session: str(20).default('2026') }), filters: ['student_id', 'unit_id', 'session', 'week'], order: 'week', student: true, unit: true },
  'pajsk-scores': { table: 'pajsk_scores', schema: z.object({ student_id: uuid, unit_id: uuid, session: str(20).default('2026'), m_kehadiran: z.coerce.number().min(0).max(100).default(0), m_jawatan: z.coerce.number().min(0).max(100).default(0), m_penglibatan: z.coerce.number().min(0).max(100).default(0), m_pencapaian: z.coerce.number().min(0).max(100).default(0) }), filters: ['student_id', 'unit_id', 'session'], order: 'total', desc: true, student: true, unit: true },
  achievements: { table: 'achievements', schema: z.object({ student_id: uuid.optional().nullable(), unit_id: uuid.optional().nullable(), title: str(160).min(1), level: level.default('sekolah'), position: optStr(80), date: dateStr }), filters: ['student_id', 'unit_id', 'level'], order: 'date', desc: true, student: true, unit: true },
  activities: { table: 'activities', schema: z.object({ title: str(160).min(1), date: dateStr, unit_id: uuid.optional().nullable(), description: optStr(2000), status: str(40).default('dirancang') }), filters: ['unit_id', 'status'], order: 'date', desc: true, unit: true },
} satisfies Record<string, Resource>
interface Resource { table: string; schema: z.AnyZodObject; filters: string[]; order: string; desc?: boolean; search?: string; student?: boolean; unit?: boolean }
// Every SQL identifier below comes from this closed registry or stripped Zod fields, never a URL/body key.
function select(r: Resource, joins: { student?: boolean; unit?: boolean } = { student: r.student, unit: r.unit }, fullStudent = false) {
  const columns = [r.table === 'students' && !fullStudent ? 't.id,t.name,t.class_id,t.kelas,t.tahun,t.jantina' : 't.*']
  let from = `${r.table} t`
  if (joins.student) {
    columns.push("CASE WHEN s.id IS NOT NULL THEN json_object('id',s.id,'name',s.name,'kelas',s.kelas,'tahun',s.tahun,'jantina',s.jantina) END AS student")
    from += ' LEFT JOIN students s ON s.id=t.student_id'
  }
  if (joins.unit) {
    columns.push("CASE WHEN u.id IS NOT NULL THEN json_object('id',u.id,'name',u.name,'kind',u.kind,'advisor',u.advisor) END AS unit")
    from += ' LEFT JOIN units u ON u.id=t.unit_id'
  }
  return `SELECT ${columns.join(',')} FROM ${from}`
}
function normalize(row: Row) {
  const out = { ...row }
  if ('present' in out) out.present = Boolean(out.present)
  for (const key of ['student', 'unit']) if (typeof out[key] === 'string') out[key] = JSON.parse(out[key] as string)
  return out
}
async function transform(db: D1Binding, r: Resource, body: Row) {
  if (r.table === 'students' && 'class_id' in body) {
    if (body.class_id) {
      const cls = await stmt(db, 'SELECT name,tahun FROM classes WHERE id=?', [body.class_id]).first()
      if (cls) return { ...body, kelas: cls.name, tahun: cls.tahun }
    } else return { ...body, kelas: '' }
  }
  return body
}
function insert(db: D1Binding, table: string, body: Row) {
  const keys = Object.keys(body)
  return stmt(db, `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(body))
}

app.post('/students/bulk', async (c) => {
  const raw: unknown = await c.req.json().catch(() => ({}))
  const rows = raw && typeof raw === 'object' && 'rows' in raw && Array.isArray(raw.rows) ? raw.rows : []
  if (!rows.length) return c.json({ error: 'Tiada baris untuk import.' }, 400)
  if (rows.length > 2000) return c.json({ error: 'Maksimum 2000 baris setiap import.' }, 400)
  const db = c.env.DB
  const existing = (await stmt(db, 'SELECT id,name,tahun FROM classes').all<{ id: string; name: string; tahun: number }>()).results
  const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row]))
  const errors: { row: number; error: string }[] = []
  const valid: z.infer<typeof bulkRowSchema>[] = []
  const newClasses: { id: string; name: string; tahun: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    const parsed = bulkRowSchema.safeParse(rows[i])
    if (!parsed.success) { errors.push({ row: i + 1, error: parsed.error.errors[0]?.message || 'tidak sah' }); continue }
    const row = parsed.data
    valid.push(row)
    if (!byName.has(row.kelas.toLowerCase())) {
      const cls = { id: crypto.randomUUID(), name: row.kelas, tahun: row.tahun ?? 1 }
      byName.set(row.kelas.toLowerCase(), cls)
      newClasses.push(cls)
    }
  }
  if (newClasses.length) {
    // JSON rows use one bound parameter, avoiding D1's bind-variable ceiling at 2000 rows.
    const result = await db.batch([
      stmt(db, `INSERT INTO classes(id,name,tahun) SELECT json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.tahun') FROM json_each(?) WHERE true ON CONFLICT(name) DO NOTHING`, [JSON.stringify(newClasses)]),
      stmt(db, 'SELECT id,name,tahun FROM classes'),
    ])
    for (const cls of result[1].results as { id: string; name: string; tahun: number }[]) byName.set(cls.name.toLowerCase(), cls)
  }
  const toInsert = valid.map((row) => {
    const cls = byName.get(row.kelas.toLowerCase())!
    return { id: crypto.randomUUID(), name: row.name, class_id: cls.id, kelas: cls.name, tahun: row.tahun ?? cls.tahun, jantina: row.jantina ?? null }
  })
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500)
    try {
      const result = await stmt(db, `INSERT INTO students(id,name,class_id,kelas,tahun,jantina)
        SELECT json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.class_id'),json_extract(value,'$.kelas'),json_extract(value,'$.tahun'),json_extract(value,'$.jantina') FROM json_each(?)`, [JSON.stringify(chunk)]).run()
      inserted += result.meta.changes ?? chunk.length
    } catch (e) { errors.push({ row: 0, error: dbError(e) }) }
  }
  return c.json({ inserted, skipped: rows.length - inserted, errors: errors.slice(0, 50) })
})

for (const [path, r] of Object.entries(resources) as [string, Resource][]) {
  const routes = new Hono<AppEnv>()
  routes.get('/', async (c) => {
    const paged = c.req.query('page') !== undefined
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1)
    const limit = Math.min(1000, Math.max(1, parseInt(c.req.query('limit') || '25', 10) || 25))
    const where: string[] = []
    const values: unknown[] = []
    for (const filter of r.filters) {
      let value = c.req.query(filter)
      if (value !== undefined && ['class_id', 'student_id', 'unit_id'].includes(filter)) {
        const parsed = uuid.safeParse(value)
        if (!parsed.success) return c.json({ error: zerr(parsed.error) }, 400)
        value = parsed.data
      }
      if (value) { where.push(`t.${filter}=?`); values.push(value) }
    }
    const search = c.req.query('q')
    if (search && r.search) { where.push(`t.${r.search} LIKE ? COLLATE NOCASE`); values.push(`%${search}%`) }
    const condition = where.length ? ' WHERE ' + where.join(' AND ') : ''
    const ordering = ` ORDER BY t.${r.order} ${r.desc ? 'DESC NULLS FIRST' : 'ASC NULLS LAST'}, t.id ASC`
    const query = stmt(c.env.DB, select(r) + condition + ordering + ' LIMIT ? OFFSET ?', [...values, paged ? limit : 1000, paged ? (page - 1) * limit : 0])
    if (!paged) return c.json((await query.all()).results.map(normalize))
    const result = await c.env.DB.batch([stmt(c.env.DB, `SELECT count(*) AS total FROM ${r.table} t` + condition, values), query])
    return c.json({ rows: result[1].results.map(normalize), total: Number(result[0].results[0].total), page, limit })
  })
  routes.get('/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: zerr(id.error) }, 400)
    const row = await stmt(c.env.DB, select(r) + ' WHERE t.id=?', [id.data]).first()
    if (!row) return c.json({ error: 'Rekod tidak dijumpai.' }, 404)
    return c.json(normalize(row))
  })
  routes.post('/', async (c) => {
    const parsed = r.schema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) return c.json({ error: zerr(parsed.error) }, 400)
    try {
      let body = await transform(c.env.DB, r, parsed.data)
      if (r.table === 'pajsk_scores') {
        const total = marks.reduce((sum, k) => sum + Number(body[k] || 0), 0)
        body = { ...body, total, grade: gradeFromTotal(total) }
      }
      const id = crypto.randomUUID()
      const result = await c.env.DB.batch([insert(c.env.DB, r.table, { ...body, id }), stmt(c.env.DB, select(r) + ' WHERE t.id=?', [id])])
      return c.json(normalize(result[1].results[0]), 201)
    } catch (e) { return c.json({ error: dbError(e) }, 400) }
  })
  routes.put('/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: zerr(id.error) }, 400)
    const raw: unknown = await c.req.json().catch(() => ({}))
    const parsed = r.schema.partial().safeParse(raw)
    if (!parsed.success) return c.json({ error: zerr(parsed.error) }, 400)
    const body: Row = {}
    for (const key of Object.keys(raw as object)) if (Object.prototype.hasOwnProperty.call(parsed.data, key)) body[key] = parsed.data[key]
    try {
      const update = await transform(c.env.DB, r, body)
      const keys = Object.keys(update)
      const values = Object.values(update)
      const sets = keys.map((k, i) => `${k}=?${i + 1}`)
      if (r.table === 'pajsk_scores' && keys.length) {
        // Same UPDATE reads current untouched marks, including simultaneous partial writes.
        const total = marks.map((k) => keys.includes(k) ? `?${keys.indexOf(k) + 1}` : k).join('+')
        sets.push(`total=${total}`, `grade=CASE WHEN (${total})>=80 THEN 'A' WHEN (${total})>=60 THEN 'B' WHEN (${total})>=40 THEN 'C' WHEN (${total})>=20 THEN 'D' ELSE 'E' END`)
      }
      const read = stmt(c.env.DB, select(r) + ' WHERE t.id=?', [id.data])
      const result = sets.length ? await c.env.DB.batch([
        stmt(c.env.DB, `UPDATE ${r.table} SET ${sets.join(',')} WHERE id=?${values.length + 1}`, [...values, id.data]), read,
      ]) : [await read.all()]
      const row = result[result.length - 1].results[0]
      if (!row) return c.json({ error: 'Rekod tidak dijumpai.' }, 400)
      return c.json(normalize(row))
    } catch (e) { return c.json({ error: dbError(e) }, 400) }
  })
  routes.delete('/:id', async (c) => {
    const id = uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: zerr(id.error) }, 400)
    try {
      await stmt(c.env.DB, `DELETE FROM ${r.table} WHERE id=?`, [id.data]).run()
      return c.json({ ok: true })
    } catch (e) { return c.json({ error: dbError(e) }, 400) }
  })
  app.route('/' + path, routes)
}

app.get('/settings', async (c) => {
  const row = await stmt(c.env.DB, 'SELECT data FROM settings WHERE id=1').first<{ data: string }>()
  return c.json(row ? JSON.parse(row.data) : {})
})
app.put('/settings', async (c) => {
  const text = await c.req.text()
  if (text.length > 50000) return c.json({ error: 'Tetapan terlalu besar.' }, 413)
  let body: unknown
  try { body = text ? JSON.parse(text) : {} } catch { return c.json({ error: 'JSON tidak sah.' }, 400) }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return c.json({ error: 'Format tetapan tidak sah.' }, 400)
  try {
    const row = await stmt(c.env.DB, 'UPDATE settings SET data=? WHERE id=1 RETURNING data', [JSON.stringify(body)]).first<{ data: string }>()
    if (!row) return c.json({ error: 'Gagal simpan tetapan.' }, 400)
    return c.json(JSON.parse(row.data))
  } catch { return c.json({ error: 'Gagal simpan tetapan.' }, 400) }
})
app.get('/stats', async (c) => {
  try {
    const row = await stmt(c.env.DB, 'SELECT data FROM dashboard_stats').first<{ data: string }>()
    if (!row) throw new Error('Missing stats')
    return c.json(JSON.parse(row.data))
  } catch { return c.json({ error: 'Gagal kira statistik.' }, 500) }
})
app.get('/reports/student/:id', async (c) => {
  const parsed = uuid.safeParse(c.req.param('id'))
  if (!parsed.success) return c.json({ error: zerr(parsed.error) }, 400)
  const id = parsed.data
  const result = await c.env.DB.batch([
    stmt(c.env.DB, select(resources.students, {}, true) + ' WHERE t.id=?', [id]),
    ...[resources.enrollments, resources['pajsk-scores'], resources.achievements].map((r) => stmt(c.env.DB, select(r, { unit: true }) + ' WHERE t.student_id=?', [id])),
    stmt(c.env.DB, 'SELECT unit_id,sum(present) AS present,count(*) AS total FROM attendance WHERE student_id=? GROUP BY unit_id', [id]),
  ])
  const student = result[0].results[0]
  if (!student) return c.json({ error: 'Murid tidak dijumpai' }, 404)
  return c.json({ student, enrollments: result[1].results.map(normalize), scores: result[2].results.map(normalize), achievements: result[3].results.map(normalize), attendance: result[4].results })
})
app.get('/reports/unit/:id', async (c) => {
  const parsed = uuid.safeParse(c.req.param('id'))
  if (!parsed.success) return c.json({ error: zerr(parsed.error) }, 400)
  const id = parsed.data
  const result = await c.env.DB.batch([
    stmt(c.env.DB, select(resources.units) + ' WHERE t.id=?', [id]),
    stmt(c.env.DB, select(resources.enrollments, { student: true }) + ' WHERE t.unit_id=?', [id]),
    stmt(c.env.DB, 'SELECT coalesce(round(avg(total),1),0) AS avgScore FROM pajsk_scores WHERE unit_id=?', [id]),
    stmt(c.env.DB, 'SELECT coalesce(round(sum(present)*100.0/nullif(count(*),0),1),0) AS attendancePct FROM attendance WHERE unit_id=?', [id]),
  ])
  const unit = result[0].results[0]
  if (!unit) return c.json({ error: 'Unit tidak dijumpai' }, 404)
  return c.json({ unit, members: result[1].results.map(normalize), avgScore: result[2].results[0].avgScore, attendancePct: result[3].results[0].attendancePct })
})

export default app
