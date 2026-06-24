import { Context, Next } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { SignJWT, jwtVerify } from 'jose'

const PROD = process.env.NODE_ENV === 'production'
// __Host- prefix binds the cookie to the exact host over https with Path=/ and
// no Domain — blocks subdomain/again-fixation attacks. Plain name in dev (http).
const COOKIE = PROD ? '__Host-koku_session' : 'koku_session'
const ISS = 'koku'
const AUD = 'koku-admin'

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) {
    // Fail closed in production: no signing secret => refuse to mint/verify.
    if (process.env.NODE_ENV === 'production')
      throw new Error('JWT_SECRET tidak ditetapkan')
    return new TextEncoder().encode('dev-only-insecure-secret')
  }
  return new TextEncoder().encode(s)
}

// Constant-time string comparison to avoid leaking the password via timing.
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function issueSession(c: Context) {
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISS)
    .setAudience(AUD)
    .setExpirationTime('2d')
    .sign(secret())
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    // Secure required for __Host- prefix; skip on local http dev so login works.
    secure: PROD,
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 2,
  })
}

export function clearSession(c: Context) {
  setCookie(c, COOKIE, '', { httpOnly: true, secure: PROD, sameSite: 'Strict', path: '/', maxAge: 0 })
}

export async function isAuthed(c: Context): Promise<boolean> {
  const token = getCookie(c, COOKIE)
  if (!token) return false
  try {
    // Pin algorithm + issuer/audience to reject alg-confusion / foreign tokens.
    await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
      issuer: ISS,
      audience: AUD,
    })
    return true
  } catch {
    return false
  }
}

// Guards write routes. Reads stay public.
export async function requireAuth(c: Context, next: Next) {
  if (await isAuthed(c)) return next()
  return c.json({ error: 'Perlu log masuk admin' }, 401)
}
