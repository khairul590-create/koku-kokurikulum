import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useList } from '../lib/hooks'
import { PageHeader, Loading, EmptyState, LevelBadge, GradeBadge } from '../components/ui'
import { exportExcel, exportPdf } from '../lib/export'
import {
  Student, Enrollment, PajskScore, Achievement, Unit,
} from '../../shared/types'

interface Report {
  student: Student
  enrollments: Enrollment[]
  scores: PajskScore[]
  achievements: Achievement[]
  attendance: { unit_id: string; present: number; total: number }[]
}

export function LaporanIndividu() {
  const { data: students } = useList<Student>('students')
  const { data: units } = useList<Unit>('units')
  const [id, setId] = useState('')

  const { data: rpt, isLoading } = useQuery({
    queryKey: ['report', 'student', id],
    queryFn: () => api.get<Report>(`/reports/student/${id}`),
    enabled: !!id,
  })

  const unitName = (uid: string) => (units ?? []).find((u) => u.id === uid)?.name ?? '—'

  function doExcel() {
    if (!rpt) return
    exportExcel(`Laporan_${rpt.student.name}`, [
      { name: 'Penyertaan', rows: rpt.enrollments.map((e) => ({ Unit: e.unit?.name, Jawatan: e.role, Peringkat: e.highest_level })) },
      { name: 'Markah', rows: rpt.scores.map((s) => ({ Unit: s.unit?.name, Sesi: s.session, Total: s.total, Gred: s.grade })) },
      { name: 'Kehadiran', rows: rpt.attendance.map((a) => ({ Unit: unitName(a.unit_id), Hadir: a.present, Jumlah: a.total })) },
      { name: 'Pencapaian', rows: rpt.achievements.map((a) => ({ Tajuk: a.title, Peringkat: a.level, Kedudukan: a.position, Tarikh: a.date })) },
    ])
  }
  function doPdf() {
    if (!rpt) return
    exportPdf(`Laporan Individu — ${rpt.student.name} (${rpt.student.kelas})`, [
      { heading: 'Penyertaan', head: ['Unit', 'Jawatan', 'Peringkat'], body: rpt.enrollments.map((e) => [e.unit?.name ?? '', e.role ?? '', e.highest_level]) },
      { heading: 'Markah PAJSK', head: ['Unit', 'Sesi', 'Total', 'Gred'], body: rpt.scores.map((s) => [s.unit?.name ?? '', s.session, s.total, s.grade]) },
      { heading: 'Kehadiran', head: ['Unit', 'Hadir', 'Jumlah'], body: rpt.attendance.map((a) => [unitName(a.unit_id), a.present, a.total]) },
      { heading: 'Pencapaian', head: ['Tajuk', 'Peringkat', 'Kedudukan', 'Tarikh'], body: rpt.achievements.map((a) => [a.title, a.level, a.position ?? '', a.date ?? '']) },
    ], `Laporan_${rpt.student.name}`)
  }

  return (
    <>
      <PageHeader title="👤 Laporan Individu" sub="Laporan lengkap setiap murid" />
      <div className="panel">
        <div className="panel-head ph-blue"><span className="ph-icon">👤</span> Pilih Murid</div>
        <div className="panel-body">
          <div className="section-filter">
            <select className="filter-select" value={id} onChange={(e) => setId(e.target.value)} style={{ minWidth: 240 }}>
              <option value="">Pilih murid…</option>
              {(students ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kelas})</option>)}
            </select>
            {rpt && <>
              <button className="btn btn-sm btn-excel" onClick={doExcel}>📊 Excel</button>
              <button className="btn btn-sm btn-pdf" onClick={doPdf}>📄 PDF</button>
            </>}
          </div>

          {!id ? <EmptyState icon="👤" text="Pilih murid untuk lihat laporan." />
            : isLoading || !rpt ? <Loading /> : (
              <>
                <div className="kpi-strip">
                  <div className="kpi"><div className="kpi-val">{rpt.enrollments.length}</div><div className="kpi-lab">Unit Disertai</div></div>
                  <div className="kpi"><div className="kpi-val">{rpt.scores.length}</div><div className="kpi-lab">Rekod Markah</div></div>
                  <div className="kpi"><div className="kpi-val">{rpt.achievements.length}</div><div className="kpi-lab">Pencapaian</div></div>
                </div>

                <ReportTable title="🎯 Penyertaan" head={['Unit', 'Jawatan', 'Peringkat']}
                  rows={rpt.enrollments.map((e) => [e.unit?.name ?? '—', e.role ?? '—', <LevelBadge key={e.id} level={e.highest_level} />])} />
                <ReportTable title="📋 Markah PAJSK" head={['Unit', 'Sesi', 'Total', 'Gred']}
                  rows={rpt.scores.map((s) => [s.unit?.name ?? '—', s.session, <b key={s.id}>{s.total}</b>, <GradeBadge key={s.id + 'g'} grade={s.grade} />])} />
                <ReportTable title="📅 Kehadiran" head={['Unit', 'Hadir', 'Peratus']}
                  rows={rpt.attendance.map((a, i) => [unitName(a.unit_id), `${a.present}/${a.total}`, `${Math.round((a.present / a.total) * 100)}%`].map((x, j) => <span key={i + '' + j}>{x}</span>))} />
                <ReportTable title="🏆 Pencapaian" head={['Tajuk', 'Peringkat', 'Kedudukan', 'Tarikh']}
                  rows={rpt.achievements.map((a) => [a.title, <LevelBadge key={a.id} level={a.level} />, a.position ?? '—', a.date ?? '—'])} />
              </>
            )}
        </div>
      </div>
    </>
  )
}

function ReportTable({ title, head, rows }: { title: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="trend-label">{title}</div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
            )) : <tr><td colSpan={head.length} style={{ textAlign: 'center', color: '#999' }}>Tiada data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
