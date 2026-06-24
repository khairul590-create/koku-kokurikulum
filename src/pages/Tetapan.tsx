import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { PageHeader, Field, Loading } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { KokuSettings, useSettings } from '../lib/settings'

type TabKey = 'profil' | 'sekolah' | 'kepimpinan' | 'pengumuman'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'profil', label: 'Profil Saya' },
  { key: 'sekolah', label: 'Sekolah' },
  { key: 'kepimpinan', label: 'Kepimpinan & Akses' },
  { key: 'pengumuman', label: 'Pengumuman' },
]

export function Tetapan() {
  const { authed } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const { settings, isLoading } = useSettings()
  const [tab, setTab] = useState<TabKey>('profil')
  const [form, setForm] = useState<KokuSettings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!form && !isLoading) setForm(settings)
  }, [isLoading, settings, form])

  if (isLoading || !form) return <Loading />

  function set<K extends keyof KokuSettings>(
    section: K,
    patch: Partial<KokuSettings[K]>,
  ) {
    setForm((f) => (f ? { ...f, [section]: { ...f[section], ...patch } } : f))
  }

  async function save() {
    if (!form) return
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

  const dis = !authed

  return (
    <>
      <PageHeader title="⚙️ Tetapan" sub="Konfigurasi sekolah, profil, kepimpinan & pengumuman" />

      {!authed && <div className="form-err">Log masuk admin untuk mengubah tetapan.</div>}

      <div className="seg-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'seg-tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="panel-body">
          {tab === 'profil' && (
            <>
              <Field label="Nama"><input disabled={dis} value={form.profile.name} onChange={(e) => set('profile', { name: e.target.value })} /></Field>
              <Field label="Jawatan"><input disabled={dis} value={form.profile.jawatan} onChange={(e) => set('profile', { jawatan: e.target.value })} placeholder="cth: GPK Kokurikulum" /></Field>
              <div className="form-row">
                <Field label="No. Telefon"><input disabled={dis} value={form.profile.phone} onChange={(e) => set('profile', { phone: e.target.value })} /></Field>
                <Field label="Emel"><input disabled={dis} type="email" value={form.profile.email} onChange={(e) => set('profile', { email: e.target.value })} /></Field>
              </div>
            </>
          )}

          {tab === 'sekolah' && (
            <>
              <div className="form-row">
                <Field label="Nama Sekolah"><input disabled={dis} value={form.school.name} onChange={(e) => set('school', { name: e.target.value })} /></Field>
                <Field label="Kod Sekolah"><input disabled={dis} value={form.school.code} onChange={(e) => set('school', { code: e.target.value })} placeholder="cth: XBA1234" /></Field>
              </div>
              <Field label="Alamat"><input disabled={dis} value={form.school.address} onChange={(e) => set('school', { address: e.target.value })} /></Field>
              <div className="form-row">
                <Field label="Daerah"><input disabled={dis} value={form.school.daerah} onChange={(e) => set('school', { daerah: e.target.value })} /></Field>
                <Field label="Negeri"><input disabled={dis} value={form.school.negeri} onChange={(e) => set('school', { negeri: e.target.value })} /></Field>
                <Field label="Sesi Semasa"><input disabled={dis} value={form.school.session} onChange={(e) => set('school', { session: e.target.value })} placeholder="cth: 2026" /></Field>
              </div>
              <Field label="Motto"><input disabled={dis} value={form.school.motto} onChange={(e) => set('school', { motto: e.target.value })} /></Field>
            </>
          )}

          {tab === 'kepimpinan' && (
            <>
              <Field label="Guru Besar"><input disabled={dis} value={form.leadership.guruBesar} onChange={(e) => set('leadership', { guruBesar: e.target.value })} /></Field>
              <Field label="GPK Kokurikulum"><input disabled={dis} value={form.leadership.gpkKoko} onChange={(e) => set('leadership', { gpkKoko: e.target.value })} /></Field>
              <Field label="Penyelaras Kokurikulum"><input disabled={dis} value={form.leadership.penyelaras} onChange={(e) => set('leadership', { penyelaras: e.target.value })} /></Field>
              <div className="form-err" style={{ background: '#f6f4ff', color: '#4527a0', padding: '10px 12px', borderRadius: 9, marginTop: 8 }}>
                🔐 Akses: sistem guna satu akaun admin. Kata laluan disimpan sebagai env var <b>ADMIN_PASSWORD</b> di Vercel. Untuk tukar, kemas kini env var tersebut di papan pemuka Vercel → Settings → Environment Variables.
              </div>
            </>
          )}

          {tab === 'pengumuman' && (
            <>
              <Field label="Teks Pengumuman">
                <textarea disabled={dis} value={form.announcement.text} onChange={(e) => set('announcement', { text: e.target.value })} placeholder="cth: Mesyuarat penyelaras kokurikulum pada 30 Jun 2026." />
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <input disabled={dis} type="checkbox" checked={form.announcement.active} onChange={(e) => set('announcement', { active: e.target.checked })} style={{ width: 'auto' }} />
                Papar pengumuman di Dashboard
              </label>
            </>
          )}

          {authed && (
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-primary" disabled={busy} onClick={save}>
                {busy ? 'Menyimpan…' : '💾 Simpan Perubahan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
