import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState } from '../components/ui'
import { useList, useCreate, useUpdate, useDelete } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Student } from '../../shared/types'

export function StudentsInfo() {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: students, isLoading } = useList<Student>('students')
  const create = useCreate<Student>('students')
  const update = useUpdate<Student>('students')
  const del = useDelete('students')

  const [editing, setEditing] = useState<Student | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')
  const [tahun, setTahun] = useState('')

  const filtered = useMemo(() => {
    return (students ?? []).filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.kelas.toLowerCase().includes(q.toLowerCase())) &&
        (!tahun || String(s.tahun) === tahun),
    )
  }, [students, q, tahun])

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
      <PageHeader
        title="👤 Urus Murid"
        sub={`${students?.length ?? 0} murid berdaftar`}
        action={authed && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Tambah Murid</button>}
      />

      <div className="panel">
        <div className="panel-head ph-blue"><span className="ph-icon">🧑‍🎓</span> Senarai Murid</div>
        <div className="panel-body">
          <div className="section-filter">
            <input className="filter-input" placeholder="🔍 Cari nama / kelas" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="filter-select" value={tahun} onChange={(e) => setTahun(e.target.value)}>
              <option value="">Semua Tahun</option>
              {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>Tahun {t}</option>)}
            </select>
          </div>
          {isLoading ? <Loading /> : !filtered.length ? (
            <EmptyState icon="🧑‍🎓" text="Tiada murid. Klik Tambah Murid." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Tahun</th>{authed && <th>Tindakan</th>}</tr></thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td><td><b>{s.name}</b></td><td>{s.kelas}</td><td>{s.tahun}</td>
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
          )}
        </div>
      </div>

      {showForm && <StudentForm student={editing} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />}
    </>
  )
}

function StudentForm({ student, onClose, onSave, busy }: {
  student: Student | null
  onClose: () => void
  onSave: (b: Partial<Student>) => void
  busy: boolean
}) {
  const [name, setName] = useState(student?.name ?? '')
  const [kelas, setKelas] = useState(student?.kelas ?? '')
  const [tahun, setTahun] = useState(student?.tahun ?? 4)
  return (
    <Modal
      title={student ? 'Edit Murid' : 'Tambah Murid'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || !kelas.trim()} onClick={() => onSave({ name: name.trim(), kelas: kelas.trim(), tahun: Number(tahun) })}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <Field label="Nama Penuh"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth: Nur Ain Sofiah" /></Field>
      <div className="form-row">
        <Field label="Kelas"><input value={kelas} onChange={(e) => setKelas(e.target.value)} placeholder="cth: 6 Umar" /></Field>
        <Field label="Tahun">
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>Tahun {t}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
