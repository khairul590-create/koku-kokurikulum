import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { PageHeader, Field, Loading } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

interface Settings {
  school?: string
  session?: string
  motto?: string
}

export function Tetapan() {
  const { authed } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings') })
  const [form, setForm] = useState<Settings>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  async function save() {
    setBusy(true)
    try {
      await api.put('/settings', form)
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast('Tetapan disimpan', 'ok')
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <>
      <PageHeader title="⚙️ Tetapan" sub="Konfigurasi maklumat sekolah & sesi" />
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="panel-head ph-indigo"><span className="ph-icon">⚙️</span> Maklumat Sekolah</div>
        <div className="panel-body">
          {!authed && <div className="form-err">Log masuk admin untuk mengubah tetapan.</div>}
          <Field label="Nama Sekolah"><input disabled={!authed} value={form.school ?? ''} onChange={(e) => setForm({ ...form, school: e.target.value })} /></Field>
          <Field label="Sesi Semasa"><input disabled={!authed} value={form.session ?? ''} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="cth: 2026" /></Field>
          <Field label="Motto"><input disabled={!authed} value={form.motto ?? ''} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></Field>
          {authed && <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan Tetapan'}</button>}
        </div>
      </div>
    </>
  )
}
