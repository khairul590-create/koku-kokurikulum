import { Hono } from 'hono'
import { z } from 'zod'
import { db } from './supabase'
import { requireAuth } from './auth'

export interface CrudOpts {
  table: string
  schema: z.AnyZodObject // validates create/update body (must be a z.object)
  select?: string // supabase select string (supports joins)
  order?: { col: string; asc?: boolean }
  filters?: string[] // query params usable as eq() filters
  searchCol?: string // column for case-insensitive ?q= search
  // Optional server-side transform (e.g. derive total/grade) after validation.
  // May be async (e.g. resolve a related row before writing).
  transform?: (
    body: Record<string, unknown>,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
}

const MAX_ROWS = 1000 // safety cap for un-paged lists
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 1000 // allows full-export paging to fetch in 1000-row chunks

export function crud(opts: CrudOpts) {
  const r = new Hono()
  const select = opts.select ?? '*'

  const prep = async (body: Record<string, unknown>) =>
    opts.transform ? await opts.transform(body) : body

  // LIST — supports eq filters, ?q= search, and ?page= pagination.
  // With ?page → returns { rows, total, page, limit }; otherwise an array.
  r.get('/', async (c) => {
    const paged = c.req.query('page') !== undefined
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(c.req.query('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    )

    let q = paged
      ? db().from(opts.table).select(select, { count: 'exact' })
      : db().from(opts.table).select(select)

    for (const f of opts.filters ?? []) {
      const v = c.req.query(f)
      if (v) q = q.eq(f, v)
    }
    const search = c.req.query('q')
    if (search && opts.searchCol) q = q.ilike(opts.searchCol, `%${search}%`)
    if (opts.order)
      q = q.order(opts.order.col, { ascending: opts.order.asc ?? true })

    if (paged) {
      const from = (page - 1) * limit
      q = q.range(from, from + limit - 1)
    } else {
      q = q.limit(MAX_ROWS)
    }

    const { data, error, count } = await q
    if (error) return c.json({ error: error.message }, 500)
    if (paged) return c.json({ rows: data, total: count ?? 0, page, limit })
    return c.json(data)
  })

  // READ ONE
  r.get('/:id', async (c) => {
    const { data, error } = await db()
      .from(opts.table)
      .select(select)
      .eq('id', c.req.param('id'))
      .single()
    if (error) return c.json({ error: error.message }, 404)
    return c.json(data)
  })

  // CREATE
  r.post('/', requireAuth, async (c) => {
    const parsed = opts.schema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success)
      return c.json({ error: zerr(parsed.error) }, 400)
    const { data, error } = await db()
      .from(opts.table)
      .insert(await prep(parsed.data))
      .select(select)
      .single()
    if (error) return c.json({ error: pgError(error) }, 400)
    return c.json(data, 201)
  })

  // UPDATE — partial-safe: only the keys the client actually sent are written,
  // so a partial body (e.g. just {highest_level}) does not fail required-field
  // validation nor clobber other columns with schema defaults.
  r.put('/:id', requireAuth, async (c) => {
    const raw = await c.req.json().catch(() => ({}))
    const parsed = opts.schema.partial().safeParse(raw)
    if (!parsed.success)
      return c.json({ error: zerr(parsed.error) }, 400)
    const body: Record<string, unknown> = {}
    for (const k of Object.keys(raw as object)) {
      if (k in (parsed.data as object))
        body[k] = (parsed.data as Record<string, unknown>)[k]
    }
    const { data, error } = await db()
      .from(opts.table)
      .update(await prep(body))
      .eq('id', c.req.param('id'))
      .select(select)
      .single()
    if (error) return c.json({ error: pgError(error) }, 400)
    return c.json(data)
  })

  // DELETE
  r.delete('/:id', requireAuth, async (c) => {
    const { error } = await db()
      .from(opts.table)
      .delete()
      .eq('id', c.req.param('id'))
    if (error) return c.json({ error: pgError(error) }, 400)
    return c.json({ ok: true })
  })

  return r
}

function zerr(e: z.ZodError): string {
  return e.errors.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')
}

// Map raw Postgres error codes to friendly Malay messages.
function pgError(e: { code?: string; message: string }): string {
  if (e.code === '23505') return 'Rekod ini sudah wujud (pendua).'
  if (e.code === '23503')
    return 'Rujukan tidak sah — rekod berkaitan tidak wujud atau telah dipadam.'
  return e.message
}
