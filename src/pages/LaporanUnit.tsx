import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useList } from '../lib/hooks'
import { PageHeader, Loading, EmptyState, LevelBadge } from '../components/ui'
import { exportExcel, exportPdf } from '../lib/export'
import { Unit, Enrollment, UNIT_KIND_LABEL } from '../../shared/types'

interface UnitReport {
  unit: Unit
  members: Enrollment[]
  avgScore: number
  attendancePct: number
}

export function LaporanUnit() {
  const { data: units } = useList<Unit>('units')
  const [id, setId] = useState('')

  const { data: rpt, isLoading } = useQuery({
    queryKey: ['report', 'unit', id],
    queryFn: () => api.get<UnitReport>(`/reports/unit/${id}`),
    enabled: !!id,
  })

  function doExcel() {
    if (!rpt) return
    exportExcel(`Laporan_Unit_${rpt.unit.name}`, [
      { name: 'Ahli', rows: rpt.members.map((m) => ({ Murid: m.student?.name, Kelas: m.student?.kelas, Jawatan: m.role, Peringkat: m.highest_level })) },
    ])
  }
  function doPdf() {
    if (!rpt) return
    exportPdf(`Laporan Unit — ${rpt.unit.name}`, [
      { heading: `Purata Markah: ${rpt.avgScore} · Kehadiran: ${rpt.attendancePct}%`, head: ['Murid', 'Kelas', 'Jawatan', 'Peringkat'], body: rpt.members.map((m) => [m.student?.name ?? '', m.student?.kelas ?? '', m.role ?? '', m.highest_level]) },
    ], `Laporan_Unit_${rpt.unit.name}`)
  }

  return (
    <>
      <PageHeader title="🏫 Laporan Unit" sub="Prestasi & keahlian setiap unit kokurikulum" />
      <div className="panel">
        <div className="panel-head ph-green"><span className="ph-icon">🏫</span> Pilih Unit</div>
        <div className="panel-body">
          <div className="section-filter">
            <select className="filter-select" value={id} onChange={(e) => setId(e.target.value)} style={{ minWidth: 240 }}>
              <option value="">Pilih unit…</option>
              {(units ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} — {UNIT_KIND_LABEL[u.kind]}</option>)}
            </select>
            {rpt && <>
              <button className="btn btn-sm btn-excel" onClick={doExcel}>📊 Excel</button>
              <button className="btn btn-sm btn-pdf" onClick={doPdf}>📄 PDF</button>
            </>}
          </div>

          {!id ? <EmptyState icon="🏫" text="Pilih unit untuk lihat laporan." />
            : isLoading || !rpt ? <Loading /> : (
              <>
                <div className="kpi-strip">
                  <div className="kpi"><div className="kpi-val">{rpt.members.length}</div><div className="kpi-lab">Bil. Ahli</div></div>
                  <div className="kpi"><div className="kpi-val">{rpt.avgScore}</div><div className="kpi-lab">Purata PAJSK</div></div>
                  <div className="kpi"><div className="kpi-val">{rpt.attendancePct}%</div><div className="kpi-lab">% Kehadiran</div></div>
                </div>
                <div className="trend-label">👥 Senarai Ahli</div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Murid</th><th>Kelas</th><th>Jawatan</th><th>Peringkat</th></tr></thead>
                    <tbody>
                      {rpt.members.length ? rpt.members.map((m, i) => (
                        <tr key={m.id}>
                          <td>{i + 1}</td><td><b>{m.student?.name ?? '—'}</b></td><td>{m.student?.kelas ?? ''}</td>
                          <td>{m.role || '—'}</td><td><LevelBadge level={m.highest_level} /></td>
                        </tr>
                      )) : <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>Tiada ahli</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
        </div>
      </div>
    </>
  )
}
