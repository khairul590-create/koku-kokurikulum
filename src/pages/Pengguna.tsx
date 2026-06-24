import { useState } from 'react'
import { PageHeader, Field } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

export function Pengguna() {
  const { authed, login, logout } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function doLogin() {
    setBusy(true)
    try {
      await login(password)
      toast('Berjaya log masuk', 'ok')
      setPassword('')
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="👥 Pengguna" sub="Akaun admin sistem (penyelaras kokurikulum)" />
      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="panel-head ph-purple"><span className="ph-icon">👤</span> Status Akaun</div>
        <div className="panel-body">
          {authed ? (
            <>
              <div className="kpi-strip">
                <div className="kpi"><div className="kpi-val" style={{ fontSize: 16 }}>Admin</div><div className="kpi-lab">Peranan</div></div>
                <div className="kpi"><div className="kpi-val" style={{ fontSize: 16, color: '#0fa968' }}>Aktif</div><div className="kpi-lab">Sesi</div></div>
              </div>
              <p className="page-sub">Anda log masuk sebagai admin. Semua fungsi tambah / edit / padam dibenarkan.</p>
              <button className="btn btn-del" onClick={logout}>Log Keluar</button>
            </>
          ) : (
            <>
              <p className="page-sub">Log masuk untuk mengurus data. Tanpa log masuk, sistem hanya boleh dibaca.</p>
              <Field label="Kata Laluan Admin">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} placeholder="Masukkan kata laluan" />
              </Field>
              <button className="btn btn-primary" disabled={busy || !password} onClick={doLogin}>{busy ? 'Memproses…' : 'Log Masuk'}</button>
            </>
          )}
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 480, marginTop: 14 }}>
        <div className="panel-head ph-blue"><span className="ph-icon">🔐</span> Nota Keselamatan</div>
        <div className="panel-body">
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Kata laluan admin disimpan sebagai env var <b>ADMIN_PASSWORD</b> di Vercel.
            Untuk tukar kata laluan, kemas kini env var tersebut di papan pemuka Vercel.
          </p>
        </div>
      </div>
    </>
  )
}
