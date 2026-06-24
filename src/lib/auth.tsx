import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, ApiError } from './api'

interface AuthCtx {
  authed: boolean
  loading: boolean
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ authed: boolean }>('/auth/me')
      .then((r) => setAuthed(r.authed))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false))
  }, [])

  async function login(password: string) {
    try {
      await api.post('/auth/login', { password })
      setAuthed(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        throw new Error('Kata laluan salah')
      throw e
    }
  }

  async function logout() {
    await api.post('/auth/logout')
    setAuthed(false)
  }

  return (
    <Ctx.Provider value={{ authed, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
