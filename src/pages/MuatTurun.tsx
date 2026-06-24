import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useList } from '../lib/hooks'
import { PageHeader } from '../components/ui'
import { useToast } from '../lib/toast'
import { exportExcel, exportPdf } from '../lib/export'
import {
  DashboardStats, Student, Unit, PajskScore, Attendance, Achievement, Activity, Enrollment,
} from '../../shared/types'

export function MuatTurun() {
  const toast = useToast()
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get<DashboardStats>('/stats') })
  const students = useList<Student>('students').data ?? []
  const units = useList<Unit>('units').data ?? []
  const enroll = useList<Enrollment>('enrollments').data ?? []
  const scores = useList<PajskScore>('pajsk-scores').data ?? []
  const att = useList<Attendance>('attendance').data ?? []
  const ach = useList<Achievement>('achievements').data ?? []
  const acts = useList<Activity>('activities').data ?? []

  function fullExcel() {
    exportExcel('Kokurikulum_SK_Darau', [
      { name: 'Murid', rows: students.map((s) => ({ Nama: s.name, Kelas: s.kelas, Tahun: s.tahun })) },
      { name: 'Unit', rows: units.map((u) => ({ Nama: u.name, Jenis: u.kind, Penasihat: u.advisor })) },
      { name: 'Penyertaan', rows: enroll.map((e) => ({ Murid: e.student?.name, Unit: e.unit?.name, Jawatan: e.role, Peringkat: e.highest_level })) },
      { name: 'Markah', rows: scores.map((s) => ({ Murid: s.student?.name, Unit: s.unit?.name, Sesi: s.session, Total: s.total, Gred: s.grade })) },
      { name: 'Kehadiran', rows: att.map((a) => ({ Murid: a.student?.name, Unit: a.unit?.name, Minggu: a.week, Hadir: a.present ? 'Ya' : 'Tidak' })) },
      { name: 'Pencapaian', rows: ach.map((a) => ({ Tajuk: a.title, Murid: a.student?.name, Unit: a.unit?.name, Peringkat: a.level, Kedudukan: a.position, Tarikh: a.date })) },
      { name: 'Takwim', rows: acts.map((a) => ({ Aktiviti: a.title, Tarikh: a.date, Unit: a.unit?.name, Status: a.status })) },
    ])
    toast('Excel dimuat turun', 'ok')
  }

  function summaryPdf() {
    if (!stats) return
    exportPdf('Laporan Ringkasan Kokurikulum', [
      { heading: 'Statistik Utama', head: ['Metrik', 'Nilai'], body: [
        ['Jumlah Murid', stats.totalStudents],
        ['Unit Kokurikulum', stats.totalUnits],
        ['% Penyertaan', `${stats.participationPct}%`],
        ['Purata PAJSK', stats.avgPajsk],
        ['Jumlah Pencapaian', stats.totalAchievements],
        ['% Kehadiran', `${stats.attendancePct}%`],
      ] },
      { heading: 'Prestasi Unit', head: ['Unit', 'Purata'], body: stats.unitAverages.map((u) => [u.name, u.avg]) },
      { heading: 'Top Murid', head: ['Nama', 'Kelas', 'Purata', 'Gred'], body: stats.topStudents.map((s) => [s.name, s.kelas, s.total, s.grade]) },
    ], 'Ringkasan_Kokurikulum')
    toast('PDF dimuat turun', 'ok')
  }

  const cards = [
    { icon: '📊', title: 'Eksport Penuh (Excel)', sub: 'Semua data — 7 helaian', cls: 'btn-excel', fn: fullExcel },
    { icon: '📄', title: 'Laporan Ringkasan (PDF)', sub: 'Statistik & prestasi', cls: 'btn-pdf', fn: summaryPdf },
    { icon: '🖨️', title: 'Cetak Halaman', sub: 'Cetak paparan semasa', cls: 'btn-print', fn: () => window.print() },
  ]

  return (
    <>
      <PageHeader title="📥 Muat Turun & Eksport" sub="Jana laporan PDF / Excel untuk fail dan pentadbiran" />
      <div className="komp-row">
        {cards.map((c) => (
          <div className="komp-card" key={c.title} style={{ cursor: 'pointer' }} onClick={c.fn}>
            <div className="k-ic">{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="k-name">{c.title}</div>
              <div className="k-sub">{c.sub}</div>
            </div>
            <button className={`act-btn ${c.cls}`} onClick={(e) => { e.stopPropagation(); c.fn() }}>Muat Turun</button>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head ph-indigo"><span className="ph-icon">📦</span> Ringkasan Data Semasa</div>
        <div className="panel-body">
          <div className="kpi-strip" style={{ marginBottom: 0 }}>
            <div className="kpi"><div className="kpi-val">{students.length}</div><div className="kpi-lab">Murid</div></div>
            <div className="kpi"><div className="kpi-val">{units.length}</div><div className="kpi-lab">Unit</div></div>
            <div className="kpi"><div className="kpi-val">{scores.length}</div><div className="kpi-lab">Markah</div></div>
            <div className="kpi"><div className="kpi-val">{att.length}</div><div className="kpi-lab">Kehadiran</div></div>
            <div className="kpi"><div className="kpi-val">{ach.length}</div><div className="kpi-lab">Pencapaian</div></div>
            <div className="kpi"><div className="kpi-val">{acts.length}</div><div className="kpi-lab">Aktiviti</div></div>
          </div>
        </div>
      </div>
    </>
  )
}
