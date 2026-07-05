import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Loading, LevelBadge, GradeBadge } from '../components/ui'
import { exportPdf, exportExcel } from '../lib/export'
import {
  Student,
  Enrollment,
  PajskScore,
  Achievement,
  UnitKind,
  UNIT_KIND_LABEL,
  GRADE_LABEL,
  gradeFromTotal,
} from '../../shared/types'

interface Report {
  student: Student
  enrollments: Enrollment[]
  scores: PajskScore[]
  achievements: Achievement[]
  attendance: { unit_id: string; present: number; total: number }[]
}

const KIND_META: Record<UnitKind, { icon: string; head: string }> = {
  kelab: { icon: '🎨', head: 'ph-orange' },
  beruniform: { icon: '🎖️', head: 'ph-indigo' },
  sukan: { icon: '⚽', head: 'ph-green' },
}
const KINDS: UnitKind[] = ['kelab', 'beruniform', 'sukan']

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function StudentProfile() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data: rpt, isLoading } = useQuery({
    queryKey: ['report', 'student', id],
    queryFn: () => api.get<Report>(`/reports/student/${id}`),
    enabled: !!id,
  })

  if (isLoading || !rpt) return <Loading />

  const s = rpt.student
  const avg = rpt.scores.length
    ? Math.round((rpt.scores.reduce((a, x) => a + Number(x.total), 0) / rpt.scores.length) * 10) / 10
    : 0
  const overall = gradeFromTotal(avg)
  const scoreFor = (uid: string) => rpt.scores.find((x) => x.unit_id === uid)
  const attFor = (uid: string) => rpt.attendance.find((a) => a.unit_id === uid)
  const unitName = (uid: string) =>
    rpt.enrollments.find((e) => e.unit_id === uid)?.unit?.name ??
    rpt.scores.find((s) => s.unit_id === uid)?.unit?.name ?? '—'

  function doExcel() {
    if (!rpt) return
    exportExcel(`Rekod_Kokurikulum_${s.name}`, [
      { name: 'Penyertaan', rows: rpt.enrollments.map((e) => ({ Unit: e.unit?.name, Jawatan: e.role, Peringkat: e.highest_level })) },
      { name: 'Markah', rows: rpt.scores.map((sc) => ({ Unit: sc.unit?.name, Sesi: sc.session, Total: sc.total, Gred: sc.grade })) },
      { name: 'Kehadiran', rows: rpt.attendance.map((a) => ({ Unit: unitName(a.unit_id), Hadir: a.present, Jumlah: a.total })) },
      { name: 'Pencapaian', rows: rpt.achievements.map((a) => ({ Tajuk: a.title, Peringkat: a.level, Kedudukan: a.position, Tarikh: a.date })) },
    ])
  }

  function doPdf() {
    if (!rpt) return
    const blocks = KINDS.filter((k) => rpt.enrollments.some((e) => e.unit?.kind === k)).map((k) => ({
      heading: UNIT_KIND_LABEL[k],
      head: ['Unit', 'Jawatan', 'Peringkat', 'Markah', 'Gred'],
      body: rpt.enrollments
        .filter((e) => e.unit?.kind === k)
        .map((e) => {
          const sc = scoreFor(e.unit_id)
          return [e.unit?.name ?? '', e.role ?? '-', e.highest_level, sc ? sc.total : '-', sc ? sc.grade : '-']
        }),
    }))
    if (rpt.achievements.length)
      blocks.push({
        heading: 'Pencapaian & Anugerah',
        head: ['Tajuk', 'Peringkat', 'Kedudukan', 'Tarikh'],
        body: rpt.achievements.map((a) => [a.title, a.level, a.position ?? '-', a.date ?? '-']),
      })
    exportPdf(
      `Rekod Kokurikulum — ${s.name} (${s.kelas})`,
      blocks.length ? blocks : [{ head: ['Maklumat'], body: [['Tiada penyertaan lagi']] }],
      `Rekod_Kokurikulum_${s.name}`,
    )
  }

  return (
    <div className="profile">
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => nav(-1)}>← Kembali</button>
        <div style={{ flex: 1 }} />
        <button className="act-btn btn-print" onClick={() => window.print()}>🖨️ Cetak</button>
        <button className="act-btn btn-excel" onClick={doExcel}>📊 Excel</button>
        <button className="act-btn btn-pdf" onClick={doPdf}>📄 PDF</button>
      </div>

      {/* HEADER */}
      <div className="panel profile-head">
        <div className="panel-body" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="profile-avatar">{initials(s.name)}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="profile-name">{s.name}</div>
            <div className="profile-meta">
              {s.kelas || '—'} · Tahun {s.tahun}
              {s.jantina ? ` · ${s.jantina === 'L' ? 'Lelaki' : 'Perempuan'}` : ''}
            </div>
          </div>
          <div className="profile-stats">
            <div className="kpi"><div className="kpi-val">{rpt.enrollments.length}</div><div className="kpi-lab">Unit Disertai</div></div>
            <div className="kpi"><div className="kpi-val">{avg || '—'}</div><div className="kpi-lab">Purata PAJSK</div></div>
            <div className="kpi"><div className="kpi-val">{rpt.scores.length ? overall : '—'}</div><div className="kpi-lab">Gred · {rpt.scores.length ? GRADE_LABEL[overall] : '-'}</div></div>
            <div className="kpi"><div className="kpi-val">{rpt.achievements.length}</div><div className="kpi-lab">Pencapaian</div></div>
          </div>
        </div>
      </div>

      {/* 3 KOMPONEN */}
      {KINDS.map((k) => {
        const items = rpt.enrollments.filter((e) => e.unit?.kind === k)
        const meta = KIND_META[k]
        return (
          <div className="panel" key={k} style={{ marginTop: 14 }}>
            <div className={`panel-head ${meta.head}`}>
              <span className="ph-icon">{meta.icon}</span> {UNIT_KIND_LABEL[k]}
            </div>
            <div className="panel-body" style={{ padding: '8px 12px' }}>
              {!items.length ? (
                <p className="page-sub" style={{ margin: '8px 4px' }}>Tiada penyertaan.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Unit</th><th>Jawatan</th><th>Peringkat</th><th>Markah</th><th>Gred</th><th>Kehadiran</th></tr></thead>
                    <tbody>
                      {items.map((e) => {
                        const sc = scoreFor(e.unit_id)
                        const at = attFor(e.unit_id)
                        return (
                          <tr key={e.id}>
                            <td><b>{e.unit?.name ?? '—'}</b></td>
                            <td>{e.role || '—'}</td>
                            <td><LevelBadge level={e.highest_level} /></td>
                            <td>{sc ? <b>{sc.total}</b> : '—'}</td>
                            <td>{sc ? <GradeBadge grade={sc.grade} /> : '—'}</td>
                            <td>{at ? `${at.present}/${at.total} (${Math.round((at.present / at.total) * 100)}%)` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* PENCAPAIAN */}
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head ph-red"><span className="ph-icon">🏆</span> Pencapaian & Anugerah</div>
        <div className="panel-body" style={{ padding: '8px 12px' }}>
          {!rpt.achievements.length ? (
            <p className="page-sub" style={{ margin: '8px 4px' }}>Tiada pencapaian direkod.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Tajuk</th><th>Peringkat</th><th>Kedudukan</th><th>Tarikh</th></tr></thead>
                <tbody>
                  {rpt.achievements.map((a: Achievement) => (
                    <tr key={a.id}>
                      <td><b>{a.title}</b></td>
                      <td><LevelBadge level={a.level} /></td>
                      <td>{a.position || '—'}</td>
                      <td>{a.date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 14 }}>
        <Link to="/murid" className="btn btn-ghost">← Senarai Murid</Link>
      </div>
    </div>
  )
}
