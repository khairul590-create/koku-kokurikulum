import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState } from '../components/ui'
import { useList, useCreate, useUpdate, useDelete } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Attendance, Student, Unit } from '../../shared/types'

export function KehadiranPage() {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: rows, isLoading } = useList<Attendance>('attendance')
  const { data: students } = useList<Student>('students')
  const { data: units } = useList<Unit>('units')
  const create = useCreate<Attendance>('attendance')
  const update = useUpdate<Attendance>('attendance')
  const del = useDelete('attendance')

  const [editing, setEditing] = useState<Attendance | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [unitFilter, setUnitFilter] = useState('')

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => !unitFilter || r.unit_id === unitFilter),
    [rows, unitFilter],
  )
  const canAdd = (students?.length ?? 0) > 0 && (units?.length ?? 0) > 0

  async function save(body: Partial<Attendance>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      toast('Kehadiran disimpan', 'ok')
      setShowForm(false)
    } catch (e) { toast((e as Error).message, 'err') }
  }
  async function remove(r: Attendance) {
    if (!confirm('Padam rekod kehadiran?')) return
    try { await del.mutateAsync(r.id); toast('Dipadam', 'ok') }
    catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <>
      <PageHeader
        title="📅 Rekod Kehadiran"
        sub="Kehadiran murid mengikut unit & minggu"
        action={authed && <button className="btn btn-primary" disabled={!canAdd} onClick={() => { setEditing(null); setShowForm(true) }}>+ Rekod Kehadiran</button>}
      />
      <div className="panel">
        <div className="panel-head ph-teal"><span className="ph-icon">📅</span> Senarai Kehadiran</div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          <div className="section-filter">
            <select className="filter-select" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">Semua Unit</option>
              {(units ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {isLoading ? <Loading /> : !filtered.length ? (
            <EmptyState icon="📅" text={canAdd ? 'Tiada rekod kehadiran.' : 'Tambah murid & unit dahulu.'} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Murid</th><th>Unit</th><th>Minggu</th><th>Sesi</th><th>Status</th>{authed && <th></th>}</tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.student?.name ?? '—'}</b></td>
                      <td>{r.unit?.name ?? '—'}</td>
                      <td>M{r.week}</td>
                      <td>{r.session}</td>
                      <td><span className={`badge ${r.present ? 'b-green' : 'b-red'}`}>{r.present ? 'Hadir' : 'Tidak Hadir'}</span></td>
                      {authed && <td><div className="row-actions">
                        <button className="btn btn-sm btn-edit" onClick={() => { setEditing(r); setShowForm(true) }}>Edit</button>
                        <button className="btn btn-sm btn-del" onClick={() => remove(r)}>Padam</button>
                      </div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <AttForm row={editing} students={students ?? []} units={units ?? []} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />
      )}
    </>
  )
}

function AttForm({ row, students, units, onClose, onSave, busy }: {
  row: Attendance | null
  students: Student[]
  units: Unit[]
  onClose: () => void
  onSave: (b: Partial<Attendance>) => void
  busy: boolean
}) {
  const [student_id, setStudent] = useState(row?.student_id ?? '')
  const [unit_id, setUnit] = useState(row?.unit_id ?? '')
  const [week, setWeek] = useState(row?.week ?? 1)
  const [session, setSession] = useState(row?.session ?? '2026')
  const [present, setPresent] = useState(row?.present ?? true)
  const valid = student_id && unit_id

  return (
    <Modal
      title={row ? 'Edit Kehadiran' : 'Rekod Kehadiran'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave({ student_id, unit_id, week: +week, session, present })}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <Field label="Murid">
          <select value={student_id} onChange={(e) => setStudent(e.target.value)}>
            <option value="">Pilih…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kelas})</option>)}
          </select>
        </Field>
        <Field label="Unit">
          <select value={unit_id} onChange={(e) => setUnit(e.target.value)}>
            <option value="">Pilih…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Minggu"><input type="number" min={1} max={52} value={week} onChange={(e) => setWeek(Number(e.target.value))} /></Field>
        <Field label="Sesi"><input value={session} onChange={(e) => setSession(e.target.value)} /></Field>
        <Field label="Status">
          <select value={present ? '1' : '0'} onChange={(e) => setPresent(e.target.value === '1')}>
            <option value="1">Hadir</option>
            <option value="0">Tidak Hadir</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}
