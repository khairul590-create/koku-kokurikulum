// Thin fetch wrapper around the /api backend. Sends cookies (admin session).
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const BASE = '/api'

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new ApiError(data?.error || res.statusText, res.status)
  }
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
}

// Fetch ALL rows of a paged resource by looping pages (for full exports).
// Avoids the un-paged 1000-row cap.
export async function fetchAll<T>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const limit = 1000
  const all: T[] = []
  for (let page = 1; page <= 1000; page++) {
    const r = await api.get<{ rows: T[]; total: number }>(
      `/${resource}${qs({ ...params, page, limit })}`,
    )
    all.push(...r.rows)
    if (r.rows.length === 0 || all.length >= r.total) break
  }
  return all
}

// Build a querystring from a record, skipping empty values.
export function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}
