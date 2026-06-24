import { useState } from 'react'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState, LevelBadge } from '../components/ui'
import { useList, useCreate, useUpdate, useDelete } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Achievement, Student, Unit, Level, LEVELS, LEVEL_LABEL } from '../../shared/types'

export function PencapaianPage() {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: rows, isLoading } = useList<Achievement>('achievements')
  const { data: students } = useList<Student>('students')
  const { data: units } = useList<Unit>('units')
  const create = useCreate<Achievement>('achievements')
  const update = useUpdate<Achievement>('achievements')
  const del = useDelete('achievements')

  const [editing, setEditing] = useState<Achievement | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function save(body: Partial<Achievement>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      toast('Pencapaian disimpan', 'ok')
      setShowForm(false)
    } catch (e) { toast((e as Error).message, 'err') }
  }
  async function remove(r: Achievement) {
    if (!confirm('Padam pencapaian?')) return
    try { await del.mutateAsync(r.id); toast('Dipadam', 'ok') }
    catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <>
      <PageHeader
        title="🏆 Pencapaian & Anugerah"
        sub="Rekod kejayaan murid / unit di pelbagai peringkat"
        action={authed && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Tambah Pencapaian</button>}
      />
      <div className="panel">
        <div className="panel-head ph-orange"><span className="ph-icon">🏆</span> Senarai Pencapaian</div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          {isLoading ? <Loading /> : !rows?.length ? (
            <EmptyState icon="🏆" text="Tiada pencapaian. Klik Tambah Pencapaian." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Tajuk</th><th>Murid</th><th>Unit</th><th>Peringkat</th><th>Kedudukan</th><th>Tarikh</th>{authed && <th></th>}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.title}</b></td>
                      <td>{r.student?.name ?? '—'}</td>
                      <td>{r.unit?.name ?? '—'}</td>
                      <td><LevelBadge level={r.level} /></td>
                      <td>{r.position || '—'}</td>
                      <td>{r.date || '—'}</td>
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
        <AchForm row={editing} students={students ?? []} units={units ?? []} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />
      )}
    </>
  )
}

function AchForm({ row, students, units, onClose, onSave, busy }: {
  row: Achievement | null
  students: Student[]
  units: Unit[]
  onClose: () => void
  onSave: (b: Partial<Achievement>) => void
  busy: boolean
}) {
  const [title, setTitle] = useState(row?.title ?? '')
  const [student_id, setStudent] = useState(row?.student_id ?? '')
  const [unit_id, setUnit] = useState(row?.unit_id ?? '')
  const [level, setLevel] = useState<Level>(row?.level ?? 'sekolah')
  const [position, setPosition] = useState(row?.position ?? '')
  const [date, setDate] = useState(row?.date ?? '')

  return (
    <Modal
      title={row ? 'Edit Pencapaian' : 'Tambah Pencapaian'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !title.trim()} onClick={() => onSave({
            title: title.trim(),
            student_id: student_id || null,
            unit_id: unit_id || null,
            level, position: position || null, date: date || null,
          })}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      }
    >
      <Field label="Tajuk Pencapaian"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="cth: Johan Olahraga MSSD" /></Field>
      <div className="form-row">
        <Field label="Murid (opsyenal)">
          <select value={student_id ?? ''} onChange={(e) => setStudent(e.target.value)}>
            <option value="">— Tiada —</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Unit (opsyenal)">
          <select value={unit_id ?? ''} onChange={(e) => setUnit(e.target.value)}>
            <option value="">— Tiada —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Peringkat">
          <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </Field>
        <Field label="Kedudukan"><input value={position ?? ''} onChange={(e) => setPosition(e.target.value)} placeholder="cth: Johan / Naib Johan" /></Field>
      </div>
      <Field label="Tarikh"><input type="date" value={date ?? ''} onChange={(e) => setDate(e.target.value)} /></Field>
    </Modal>
  )
}
