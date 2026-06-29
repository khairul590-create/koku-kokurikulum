import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState } from '../components/ui'
import { ImportStudents } from '../components/ImportStudents'
import { useList, useCreate, useUpdate, useDelete, usePagedList } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Student, Class, Jantina } from '../../shared/types'

const PAGE_SIZE = 25
const TAB = { murid: 'Murid', kelas: 'Kelas' } as const
type TabKey = keyof typeof TAB

export function StudentsInfo() {
  const { authed } = useAuth()
  const [tab, setTab] = useState<TabKey>('murid')

  return (
    <>
      <PageHeader title="👤 Urus Murid" sub="Murid & kelas sekolah" />
      <div className="seg-tabs">
        {(Object.keys(TAB) as TabKey[]).map((k) => (
          <button key={k} className={'seg-tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>
            {TAB[k]}
          </button>
        ))}
      </div>
      {tab === 'murid' ? <MuridTab authed={authed} /> : <KelasTab authed={authed} />}
    </>
  )
}

/* ─────────────── MURID TAB ─────────────── */
function MuridTab({ authed }: { authed: boolean }) {
  const toast = useToast()
  const { data: classes } = useList<Class>('classes')
  const create = useCreate<Student>('students')
  const update = useUpdate<Student>('students')
  const del = useDelete('students')

  const [page, setPage] = useState(1)
  const [tahun, setTahun] = useState('')
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [editing, setEditing] = useState<Student | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // debounce search; reset to page 1 on any filter change
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [debounced, tahun, classId])

  const { data, isLoading, isFetching } = usePagedList<Student>('students', {
    page,
    limit: PAGE_SIZE,
    q: debounced || undefined,
    tahun: tahun || undefined,
    class_id: classId || undefined,
  })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function save(body: Partial<Student>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      toast('Murid disimpan', 'ok')
      setShowForm(false)
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  async function remove(s: Student) {
    if (!confirm(`Padam murid "${s.name}"? Semua rekod berkaitan turut dipadam.`)) return
    try {
      await del.mutateAsync(s.id)
      toast('Murid dipadam', 'ok')
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {authed && <button className="btn btn-ghost" onClick={() => setShowImport(true)}>📥 Import CSV/Excel</button>}
        {authed && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Tambah Murid</button>}
      </div>

      <div className="panel">
        <div className="panel-head ph-blue"><span className="ph-icon">🧑‍🎓</span> Senarai Murid</div>
        <div className="panel-body">
          <div className="section-filter">
            <input className="filter-input" placeholder="🔍 Cari nama" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 180 }} />
            <select className="filter-select" value={tahun} onChange={(e) => setTahun(e.target.value)}>
              <option value="">Semua Tahun</option>
              {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>Tahun {t}</option>)}
            </select>
            <select className="filter-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Semua Kelas</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {isLoading ? <Loading /> : total === 0 ? (
            <EmptyState icon="🧑‍🎓" text={debounced || tahun || classId ? 'Tiada padanan.' : 'Tiada murid. Tambah atau Import.'} />
          ) : (
            <>
              <div className="table-wrap" style={{ opacity: isFetching ? 0.6 : 1 }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Tahun</th><th>Jantina</th>{authed && <th>Tindakan</th>}</tr></thead>
                  <tbody>
                    {rows.map((s, i) => (
                      <tr key={s.id}>
                        <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td><Link to={`/murid/${s.id}`} className="link-name">{s.name}</Link></td>
                        <td>{s.kelas || '—'}</td>
                        <td>{s.tahun}</td>
                        <td>{s.jantina ? <span className={`badge ${s.jantina === 'L' ? 'b-blue' : 'b-red'}`}>{s.jantina}</span> : '—'}</td>
                        {authed && <td>
                          <div className="row-actions">
                            <button className="btn btn-sm btn-edit" onClick={() => { setEditing(s); setShowForm(true) }}>Edit</button>
                            <button className="btn btn-sm btn-del" onClick={() => remove(s)}>Padam</button>
                          </div>
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pager">
                <div className="pager-info">{total} murid · halaman {page}/{lastPage}</div>
                <div className="pager-btns">
                  <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Sebelum</button>
                  <button className="btn btn-sm btn-ghost" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Seterus →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showForm && <StudentForm student={editing} classes={classes ?? []} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />}
      {showImport && <ImportStudents onClose={() => setShowImport(false)} />}
    </>
  )
}

function StudentForm({ student, classes, onClose, onSave, busy }: {
  student: Student | null
  classes: Class[]
  onClose: () => void
  onSave: (b: Partial<Student>) => void
  busy: boolean
}) {
  const [name, setName] = useState(student?.name ?? '')
  const [classId, setClassId] = useState(student?.class_id ?? '')
  const [jantina, setJantina] = useState<Jantina | ''>(student?.jantina ?? '')
  return (
    <Modal
      title={student ? 'Edit Murid' : 'Tambah Murid'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || !classId} onClick={() => onSave({ name: name.trim(), class_id: classId, jantina: jantina || null })}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <Field label="Nama Penuh"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth: Nur Ain Sofiah" /></Field>
      <div className="form-row">
        <Field label="Kelas">
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Jantina">
          <select value={jantina} onChange={(e) => setJantina(e.target.value as Jantina | '')}>
            <option value="">—</option>
            <option value="L">Lelaki</option>
            <option value="P">Perempuan</option>
          </select>
        </Field>
      </div>
      {!classes.length && <p className="page-sub">Tiada kelas lagi. Tambah kelas di tab Kelas dahulu.</p>}
    </Modal>
  )
}

/* ─────────────── KELAS TAB ─────────────── */
function KelasTab({ authed }: { authed: boolean }) {
  const toast = useToast()
  const { data: classes, isLoading } = useList<Class>('classes')
  const create = useCreate<Class>('classes')
  const update = useUpdate<Class>('classes')
  const del = useDelete('classes')
  const [editing, setEditing] = useState<Class | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function save(body: Partial<Class>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      toast('Kelas disimpan', 'ok')
      setShowForm(false)
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  async function remove(c: Class) {
    if (!confirm(`Padam kelas "${c.name}"? Murid dalam kelas ini tidak dipadam tetapi akan jadi tanpa kelas.`)) return
    try { await del.mutateAsync(c.id); toast('Kelas dipadam', 'ok') }
    catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {authed && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Tambah Kelas</button>}
      </div>
      <div className="panel">
        <div className="panel-head ph-indigo"><span className="ph-icon">🏫</span> Senarai Kelas</div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          {isLoading ? <Loading /> : !classes?.length ? (
            <EmptyState icon="🏫" text="Tiada kelas. Klik Tambah Kelas." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>Nama Kelas</th><th>Tahun</th><th>Guru Kelas</th>{authed && <th>Tindakan</th>}</tr></thead>
                <tbody>
                  {classes.map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td><td><b>{c.name}</b></td><td>{c.tahun}</td><td>{c.guru_kelas || '—'}</td>
                      {authed && <td>
                        <div className="row-actions">
                          <button className="btn btn-sm btn-edit" onClick={() => { setEditing(c); setShowForm(true) }}>Edit</button>
                          <button className="btn btn-sm btn-del" onClick={() => remove(c)}>Padam</button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showForm && <ClassForm cls={editing} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />}
    </>
  )
}

function ClassForm({ cls, onClose, onSave, busy }: {
  cls: Class | null
  onClose: () => void
  onSave: (b: Partial<Class>) => void
  busy: boolean
}) {
  const [name, setName] = useState(cls?.name ?? '')
  const [tahun, setTahun] = useState(cls?.tahun ?? 1)
  const [guru, setGuru] = useState(cls?.guru_kelas ?? '')
  return (
    <Modal
      title={cls ? 'Edit Kelas' : 'Tambah Kelas'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => onSave({ name: name.trim(), tahun: Number(tahun), guru_kelas: guru.trim() || null })}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <Field label="Nama Kelas"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth: 6 Amanah" /></Field>
        <Field label="Tahun">
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>Tahun {t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Guru Kelas"><input value={guru ?? ''} onChange={(e) => setGuru(e.target.value)} placeholder="cth: Cikgu Siti" /></Field>
    </Modal>
  )
}
