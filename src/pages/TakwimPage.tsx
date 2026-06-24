import { useState } from 'react'
import { Modal } from '../components/Modal'
import { Field, PageHeader, Loading, EmptyState } from '../components/ui'
import { useList, useCreate, useUpdate, useDelete } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Activity, Unit } from '../../shared/types'

const STATUS = ['dirancang', 'sedang berjalan', 'selesai', 'ditangguh']
const STATUS_BADGE: Record<string, string> = {
  dirancang: 'b-blue', 'sedang berjalan': 'b-orange', selesai: 'b-green', ditangguh: 'b-red',
}

export function TakwimPage() {
  const { authed } = useAuth()
  const toast = useToast()
  const { data: rows, isLoading } = useList<Activity>('activities')
  const { data: units } = useList<Unit>('units')
  const create = useCreate<Activity>('activities')
  const update = useUpdate<Activity>('activities')
  const del = useDelete('activities')

  const [editing, setEditing] = useState<Activity | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function save(body: Partial<Activity>) {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body })
      else await create.mutateAsync(body)
      toast('Aktiviti disimpan', 'ok')
      setShowForm(false)
    } catch (e) { toast((e as Error).message, 'err') }
  }
  async function remove(r: Activity) {
    if (!confirm('Padam aktiviti?')) return
    try { await del.mutateAsync(r.id); toast('Dipadam', 'ok') }
    catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <>
      <PageHeader
        title="🗓️ Takwim Aktiviti"
        sub="Jadual & rekod aktiviti kokurikulum"
        action={authed && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Tambah Aktiviti</button>}
      />
      <div className="panel">
        <div className="panel-head ph-purple"><span className="ph-icon">🗓️</span> Senarai Aktiviti</div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          {isLoading ? <Loading /> : !rows?.length ? (
            <EmptyState icon="🗓️" text="Tiada aktiviti. Klik Tambah Aktiviti." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Tarikh</th><th>Aktiviti</th><th>Unit</th><th>Status</th><th>Catatan</th>{authed && <th></th>}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date || '—'}</td>
                      <td><b>{r.title}</b></td>
                      <td>{r.unit?.name ?? '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status] || 'b-grey'}`}>{r.status}</span></td>
                      <td style={{ maxWidth: 200 }}>{r.description || '—'}</td>
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
        <ActForm row={editing} units={units ?? []} onClose={() => setShowForm(false)} onSave={save} busy={create.isPending || update.isPending} />
      )}
    </>
  )
}

function ActForm({ row, units, onClose, onSave, busy }: {
  row: Activity | null
  units: Unit[]
  onClose: () => void
  onSave: (b: Partial<Activity>) => void
  busy: boolean
}) {
  const [title, setTitle] = useState(row?.title ?? '')
  const [date, setDate] = useState(row?.date ?? '')
  const [unit_id, setUnit] = useState(row?.unit_id ?? '')
  const [status, setStatus] = useState(row?.status ?? 'dirancang')
  const [description, setDesc] = useState(row?.description ?? '')

  return (
    <Modal
      title={row ? 'Edit Aktiviti' : 'Tambah Aktiviti'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !title.trim()} onClick={() => onSave({
            title: title.trim(), date: date || null, unit_id: unit_id || null, status, description: description || null,
          })}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      }
    >
      <Field label="Nama Aktiviti"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="cth: Perkhemahan Pengakap" /></Field>
      <div className="form-row">
        <Field label="Tarikh"><input type="date" value={date ?? ''} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Unit (opsyenal)">
        <select value={unit_id ?? ''} onChange={(e) => setUnit(e.target.value)}>
          <option value="">— Tiada —</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Catatan"><textarea value={description ?? ''} onChange={(e) => setDesc(e.target.value)} placeholder="Butiran aktiviti…" /></Field>
    </Modal>
  )
}
