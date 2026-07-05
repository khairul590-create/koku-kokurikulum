import { useState } from 'react'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState, LevelBadge } from '../components/ui'
import { useList, useCreate, useUpdate, useDelete } from '../lib/hooks'
import { StudentPicker } from '../components/StudentPicker'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import {
  Unit, UnitKind, UNIT_KINDS, UNIT_KIND_LABEL, Enrollment, Level, LEVELS, LEVEL_LABEL,
} from '../../shared/types'

const KIND_META: Record<UnitKind, { icon: string; head: string }> = {
  kelab: { icon: '🎨', head: 'ph-orange' },
  beruniform: { icon: '🎖️', head: 'ph-indigo' },
  sukan: { icon: '⚽', head: 'ph-green' },
}

// One page, 3 tabs — replaces the separate Kelab/Beruniform/Sukan menu items.
export function UnitKokurikulum() {
  const [kind, setKind] = useState<UnitKind>('kelab')
  return (
    <>
      <div className="seg-tabs">
        {UNIT_KINDS.map((k) => (
          <button key={k} className={'seg-tab' + (kind === k ? ' active' : '')} onClick={() => setKind(k)}>
            {KIND_META[k].icon} {UNIT_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <UnitsPage key={kind} kind={kind} />
    </>
  )
}

export function UnitsPage({ kind }: { kind: UnitKind }) {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: units, isLoading } = useList<Unit>('units', { kind })
  const { data: enrollments } = useList<Enrollment>('enrollments')
  const create = useCreate<Unit>('units')
  const update = useUpdate<Unit>('units')
  const del = useDelete('units')

  const [editing, setEditing] = useState<Unit | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [membersOf, setMembersOf] = useState<Unit | null>(null)

  const meta = KIND_META[kind]
  const countFor = (uid: string) =>
    (enrollments ?? []).filter((e) => e.unit_id === uid).length

  function openNew() {
    setEditing(null)
    setShowForm(true)
  }
  function openEdit(u: Unit) {
    setEditing(u)
    setShowForm(true)
  }

  async function save(body: Partial<Unit>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync({ ...body, kind })
      toast('Unit disimpan', 'ok')
      setShowForm(false)
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  async function remove(u: Unit) {
    if (!confirm(`Padam unit "${u.name}"? Semua data berkaitan turut dipadam.`)) return
    try {
      await del.mutateAsync(u.id)
      toast('Unit dipadam', 'ok')
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  return (
    <>
      <PageHeader
        title={`${meta.icon} ${UNIT_KIND_LABEL[kind]}`}
        sub={`${units?.length ?? 0} unit`}
        action={authed && <button className="btn btn-primary" onClick={openNew}>+ Tambah Unit</button>}
      />

      <div className="panel">
        <div className={`panel-head ${meta.head}`}>
          <span className="ph-icon">{meta.icon}</span> Senarai Unit
        </div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          {isLoading ? <Loading /> : !units?.length ? (
            <EmptyState icon={meta.icon} text="Tiada unit lagi. Klik Tambah Unit." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Nama Unit</th><th>Guru Penasihat</th><th>Bil. Ahli</th><th>Tindakan</th></tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={u.id}>
                      <td>{i + 1}</td>
                      <td><b>{u.name}</b></td>
                      <td>{u.advisor || '—'}</td>
                      <td><span className="badge b-indigo">{countFor(u.id)} ahli</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => setMembersOf(u)}>Ahli</button>
                          {authed && <button className="btn btn-sm btn-edit" onClick={() => openEdit(u)}>Edit</button>}
                          {authed && <button className="btn btn-sm btn-del" onClick={() => remove(u)}>Padam</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <UnitForm unit={editing} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />
      )}
      {membersOf && <MembersModal unit={membersOf} onClose={() => setMembersOf(null)} />}
    </>
  )
}

function UnitForm({ unit, onClose, onSave, busy }: {
  unit: Unit | null
  onClose: () => void
  onSave: (b: Partial<Unit>) => void
  busy: boolean
}) {
  const [name, setName] = useState(unit?.name ?? '')
  const [advisor, setAdvisor] = useState(unit?.advisor ?? '')
  return (
    <Modal
      title={unit ? 'Edit Unit' : 'Tambah Unit'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => onSave({ name: name.trim(), advisor: advisor.trim() || null })}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <Field label="Nama Unit"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="cth: Pengakap" /></Field>
      <Field label="Guru Penasihat"><input value={advisor ?? ''} onChange={(e) => setAdvisor(e.target.value)} placeholder="cth: Cikgu Ali" /></Field>
    </Modal>
  )
}

function MembersModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: members } = useList<Enrollment>('enrollments', { unit_id: unit.id })
  const create = useCreate<Enrollment>('enrollments')
  const update = useUpdate<Enrollment>('enrollments')
  const del = useDelete('enrollments')

  const [sid, setSid] = useState('')
  const [role, setRole] = useState('')
  const [level, setLevel] = useState<Level>('sekolah')

  async function add() {
    if (!sid) return
    try {
      await create.mutateAsync({ student_id: sid, unit_id: unit.id, role: role || null, highest_level: level })
      toast('Ahli ditambah', 'ok')
      setSid(''); setRole(''); setLevel('sekolah')
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  async function changeLevel(m: Enrollment, lv: Level) {
    try {
      await update.mutateAsync({ id: m.id, body: { highest_level: lv } })
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  async function remove(m: Enrollment) {
    try {
      await del.mutateAsync(m.id)
      toast('Ahli dikeluarkan', 'ok')
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  return (
    <Modal title={`👥 Ahli — ${unit.name}`} onClose={onClose}>
      {authed && (
        <div className="section-filter" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <StudentPicker value={sid} onChange={(id) => setSid(id)} placeholder="Cari murid untuk tambah…" />
          </div>
          <input className="filter-input" placeholder="Jawatan (opsyenal)" value={role} onChange={(e) => setRole(e.target.value)} />
          <select className="filter-select" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" disabled={!sid || create.isPending} onClick={add}>Tambah</button>
        </div>
      )}
      {!members?.length ? (
        <EmptyState icon="👥" text="Tiada ahli lagi." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Murid</th><th>Kelas</th><th>Jawatan</th><th>Peringkat</th>{authed && <th></th>}</tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.student?.name ?? '—'}</td>
                  <td>{m.student?.kelas ?? ''}</td>
                  <td>{m.role || '—'}</td>
                  <td>
                    {authed ? (
                      <select className="filter-select" value={m.highest_level} onChange={(e) => changeLevel(m, e.target.value as Level)}>
                        {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                      </select>
                    ) : <LevelBadge level={m.highest_level} />}
                  </td>
                  {authed && <td><button className="btn btn-sm btn-del" onClick={() => remove(m)}>Buang</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
