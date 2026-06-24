import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await login(password)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <img src="/icon.svg" alt="Logo" width={72} height={72} className="login-logo" />
        <div className="login-title">Sistem Pengurusan Kokurikulum</div>
        <div className="login-sub">SK Darau · Log masuk untuk teruskan</div>
        {err && <div className="form-err" style={{ width: '100%' }}>{err}</div>}
        <input
          type="password"
          autoFocus
          className="login-input"
          placeholder="Kata laluan admin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-primary login-btn" disabled={busy || !password}>
          {busy ? 'Memproses…' : '🔑 Log Masuk'}
        </button>
        <div className="login-foot">Akses terhad — data murid dilindungi</div>
      </form>
    </div>
  )
}
