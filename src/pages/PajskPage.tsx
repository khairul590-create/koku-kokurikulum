import { useState } from 'react'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState, GradeBadge } from '../components/ui'
import { useList, useCreate, useUpdate, useDelete, usePagedList } from '../lib/hooks'
import { StudentPicker } from '../components/StudentPicker'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { PajskScore, Student, Unit, gradeFromTotal } from '../../shared/types'

export function PajskPage() {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: scores, isLoading } = useList<PajskScore>('pajsk-scores')
  const studentsHead = usePagedList<Student>('students', { page: 1, limit: 1 })
  const { data: units } = useList<Unit>('units')
  const create = useCreate<PajskScore>('pajsk-scores')
  const update = useUpdate<PajskScore>('pajsk-scores')
  const del = useDelete('pajsk-scores')

  const [editing, setEditing] = useState<PajskScore | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function save(body: Partial<PajskScore>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      toast('Markah disimpan', 'ok')
      setShowForm(false)
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  async function remove(s: PajskScore) {
    if (!confirm('Padam markah ini?')) return
    try { await del.mutateAsync(s.id); toast('Markah dipadam', 'ok') }
    catch (e) { toast((e as Error).message, 'err') }
  }

  const canAdd = (studentsHead.data?.total ?? 0) > 0 && (units?.length ?? 0) > 0

  return (
    <>
      <PageHeader
        title="📋 Pentaksiran PAJSK"
        sub="Markah komponen kokurikulum · gred dikira automatik"
        action={authed && <button className="btn btn-primary" disabled={!canAdd} onClick={() => { setEditing(null); setShowForm(true) }}>+ Masuk Markah</button>}
      />
      <div className="panel">
        <div className="panel-head ph-indigo"><span className="ph-icon">📋</span> Rekod Markah PAJSK</div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          {isLoading ? <Loading /> : !scores?.length ? (
            <EmptyState icon="📋" text={canAdd ? 'Tiada markah. Klik Masuk Markah.' : 'Tambah murid & unit dahulu.'} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Murid</th><th>Unit</th><th>Sesi</th><th>Hadir</th><th>Jawatan</th><th>Libat</th><th>Capai</th><th>Total</th><th>Gred</th>{authed && <th></th>}</tr></thead>
                <tbody>
                  {scores.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.student?.name ?? '—'}</b></td>
                      <td>{s.unit?.name ?? '—'}</td>
                      <td>{s.session}</td>
                      <td>{s.m_kehadiran}</td><td>{s.m_jawatan}</td><td>{s.m_penglibatan}</td><td>{s.m_pencapaian}</td>
                      <td><b>{s.total}</b></td>
                      <td><GradeBadge grade={s.grade} /></td>
                      {authed && <td><div className="row-actions">
                        <button className="btn btn-sm btn-edit" onClick={() => { setEditing(s); setShowForm(true) }}>Edit</button>
                        <button className="btn btn-sm btn-del" onClick={() => remove(s)}>Padam</button>
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
        <PajskForm score={editing} units={units ?? []} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />
      )}
    </>
  )
}

function PajskForm({ score, units, onClose, onSave, busy }: {
  score: PajskScore | null
  units: Unit[]
  onClose: () => void
  onSave: (b: Partial<PajskScore>) => void
  busy: boolean
}) {
  const [f, setF] = useState({
    student_id: score?.student_id ?? '',
    unit_id: score?.unit_id ?? '',
    session: score?.session ?? '2026',
    m_kehadiran: score?.m_kehadiran ?? 0,
    m_jawatan: score?.m_jawatan ?? 0,
    m_penglibatan: score?.m_penglibatan ?? 0,
    m_pencapaian: score?.m_pencapaian ?? 0,
  })
  const total = Number(f.m_kehadiran) + Number(f.m_jawatan) + Number(f.m_penglibatan) + Number(f.m_pencapaian)
  const grade = gradeFromTotal(total)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.student_id && f.unit_id

  return (
    <Modal
      title={score ? 'Edit Markah PAJSK' : 'Masuk Markah PAJSK'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave({ ...f, m_kehadiran: +f.m_kehadiran, m_jawatan: +f.m_jawatan, m_penglibatan: +f.m_penglibatan, m_pencapaian: +f.m_pencapaian })}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <Field label="Murid">
          <StudentPicker value={f.student_id} onChange={(id) => set('student_id', id)} />
        </Field>
        <Field label="Unit">
          <select value={f.unit_id} onChange={(e) => set('unit_id', e.target.value)}>
            <option value="">Pilih…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Sesi"><input value={f.session} onChange={(e) => set('session', e.target.value)} /></Field>
      <div className="form-row">
        <Field label="Kehadiran (/50)"><input type="number" value={f.m_kehadiran} onChange={(e) => set('m_kehadiran', e.target.value)} /></Field>
        <Field label="Jawatan (/10)"><input type="number" value={f.m_jawatan} onChange={(e) => set('m_jawatan', e.target.value)} /></Field>
      </div>
      <div className="form-row">
        <Field label="Penglibatan (/20)"><input type="number" value={f.m_penglibatan} onChange={(e) => set('m_penglibatan', e.target.value)} /></Field>
        <Field label="Pencapaian (/20)"><input type="number" value={f.m_pencapaian} onChange={(e) => set('m_pencapaian', e.target.value)} /></Field>
      </div>
      <div className="kpi-strip" style={{ marginBottom: 0 }}>
        <div className="kpi"><div className="kpi-val">{total}</div><div className="kpi-lab">Jumlah Markah</div></div>
        <div className="kpi"><div className="kpi-val">{grade}</div><div className="kpi-lab">Gred Automatik</div></div>
      </div>
    </Modal>
  )
}
