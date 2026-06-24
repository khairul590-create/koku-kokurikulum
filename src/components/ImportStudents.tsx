import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { Modal } from './Modal'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'

interface Row {
  name: string
  kelas: string
  tahun?: number
  jantina?: 'L' | 'P' | null
}
interface Summary {
  inserted: number
  skipped: number
  errors: { row: number; error: string }[]
}

const lower = (o: Record<string, unknown>) => {
  const r: Record<string, unknown> = {}
  for (const k of Object.keys(o)) r[k.toLowerCase().trim()] = o[k]
  return r
}
const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim()
  return ''
}
function normJantina(v: string): 'L' | 'P' | null {
  const s = v.toUpperCase()
  if (['L', 'LELAKI', 'M', 'MALE'].includes(s)) return 'L'
  if (['P', 'PEREMPUAN', 'F', 'FEMALE'].includes(s)) return 'P'
  return null
}

export function ImportStudents({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [err, setErr] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    setSummary(null)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      const parsed: Row[] = json
        .map((raw) => {
          const o = lower(raw)
          const name = pick(o, ['nama', 'name'])
          const kelas = pick(o, ['kelas', 'class', 'kls'])
          const tahunRaw = pick(o, ['tahun', 'year', 'thn'])
          const jantinaRaw = pick(o, ['jantina', 'gender', 'sex'])
          return {
            name,
            kelas,
            tahun: tahunRaw ? Number(tahunRaw) : undefined,
            jantina: jantinaRaw ? normJantina(jantinaRaw) : null,
          }
        })
        .filter((r) => r.name && r.kelas)
      if (!parsed.length)
        setErr('Tiada baris sah. Pastikan ada lajur "Nama" dan "Kelas".')
      setRows(parsed)
    } catch {
      setErr('Gagal baca fail. Guna format CSV atau XLSX.')
      setRows([])
    }
  }

  async function doImport() {
    setBusy(true)
    setErr('')
    try {
      const res = await api.post<Summary>('/students/bulk', { rows })
      setSummary(res)
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['classes'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast(`${res.inserted} murid diimport`, 'ok')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="📥 Import Murid (CSV / Excel)" onClose={onClose}>
      {!summary && (
        <>
          <p className="page-sub" style={{ marginBottom: 10 }}>
            Lajur diperlukan: <b>Nama</b>, <b>Kelas</b>. Opsyenal: <b>Tahun</b>,{' '}
            <b>Jantina</b> (L/P). Kelas baharu akan dicipta automatik.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFile}
            style={{ marginBottom: 12 }}
          />
          {err && <div className="form-err">{err}</div>}
          {rows.length > 0 && (
            <>
              <div className="kpi-strip" style={{ marginBottom: 10 }}>
                <div className="kpi">
                  <div className="kpi-val">{rows.length}</div>
                  <div className="kpi-lab">Baris dikesan ({fileName})</div>
                </div>
              </div>
              <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Nama</th><th>Kelas</th><th>Tahun</th><th>Jantina</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td><td>{r.kelas}</td>
                        <td>{r.tahun ?? '—'}</td><td>{r.jantina ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 8 && (
                <p className="page-sub" style={{ marginTop: 6 }}>
                  …dan {rows.length - 8} lagi
                </p>
              )}
            </>
          )}
          <div className="modal-foot" style={{ padding: '14px 0 0' }}>
            <button className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button className="btn btn-primary" disabled={busy || !rows.length} onClick={doImport}>
              {busy ? 'Mengimport…' : `Import ${rows.length || ''} Murid`}
            </button>
          </div>
        </>
      )}

      {summary && (
        <>
          <div className="kpi-strip">
            <div className="kpi"><div className="kpi-val" style={{ color: '#2e7d32' }}>{summary.inserted}</div><div className="kpi-lab">Berjaya</div></div>
            <div className="kpi"><div className="kpi-val" style={{ color: '#c62828' }}>{summary.skipped}</div><div className="kpi-lab">Dilangkau</div></div>
          </div>
          {summary.errors.length > 0 && (
            <div className="table-wrap" style={{ maxHeight: 180, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Baris</th><th>Ralat</th></tr></thead>
                <tbody>
                  {summary.errors.map((e, i) => (
                    <tr key={i}><td>{e.row || '—'}</td><td>{e.error}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-foot" style={{ padding: '14px 0 0' }}>
            <button className="btn btn-primary" onClick={onClose}>Selesai</button>
          </div>
        </>
      )}
    </Modal>
  )
}
