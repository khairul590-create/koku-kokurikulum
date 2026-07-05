import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useSettings } from '../lib/settings'
import { Loading } from '../components/ui'
import {
  DashboardStats,
  GRADE_LABEL,
  LEVEL_LABEL,
  UNIT_KIND_LABEL,
} from '../../shared/types'

const BAR_COLORS = ['bf-green', 'bf-blue', 'bf-red', 'bf-indigo', 'bf-purple', 'bf-orange', 'bf-teal']
const GRADE_COLORS: Record<string, string> = {
  A: '#0fa968', B: '#1a73e8', C: '#f9a825', D: '#ff6d00', E: '#e53935',
}
const LEVEL_COLORS = ['#5e35b1', '#1a73e8', '#0fa968', '#f9a825', '#e53935']

export function Dashboard() {
  const { settings } = useSettings()
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<DashboardStats>('/stats'),
  })

  if (isLoading || !data) return <Loading />

  const ann = settings.announcement

  const maxBar = Math.max(...data.unitAverages.map((u) => u.avg), 100)
  const topUnits = data.unitAverages.filter((u) => u.avg > 0).slice(0, 8)
  const maxLevel = Math.max(...data.levelDist.map((l) => l.count), 1)

  return (
    <>
      {ann.active && ann.text && (
        <div className="announce-banner">📢 {ann.text}</div>
      )}

      {/* STAT CARDS */}
      <div className="stat-row">
        <Stat cls="sc1" icon="🧑‍🎓" val={data.totalStudents} label="Jumlah Murid" />
        <Stat cls="sc2" icon="🎯" val={data.totalUnits} label="Unit Kokurikulum" />
        <Stat cls="sc3" icon="✅" val={`${data.participationPct}%`} label="% Penyertaan" />
        <Stat cls="sc4" icon="📈" val={data.avgPajsk} label="Purata PAJSK" />
        <Stat cls="sc5" icon="🏆" val={data.totalAchievements} label="Pencapaian" />
        <Stat cls="sc6" icon="📅" val={`${data.attendancePct}%`} label="% Kehadiran" />
      </div>

      {/* KOMPONEN WAJIB */}
      <div className="komp-row">
        {data.komponen.map((k, i) => (
          <div className={`komp-card ${['kc-orange', '', 'kc-green'][i]}`} key={k.kind}>
            <div className="k-ic">{['🎨', '🎖️', '⚽'][i]}</div>
            <div>
              <div className="k-val">{k.students}</div>
              <div className="k-name">{UNIT_KIND_LABEL[k.kind]}</div>
              <div className="k-sub">{k.units} unit · purata {k.avg} markah</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mid-row">
        {/* BAR CHART */}
        <div className="panel panel-penyertaan">
          <div className="panel-head ph-indigo">
            <span className="ph-icon">📊</span> PURATA MARKAH PAJSK MENGIKUT UNIT
          </div>
          <div className="panel-body">
            {topUnits.length === 0 ? (
              <p className="page-sub">Tiada markah PAJSK lagi. Masukkan markah di tab Pentaksiran PAJSK.</p>
            ) : (
              <div className="bar-group">
                {topUnits.map((u, i) => (
                  <div className="bar-item" key={u.name}>
                    <div className="bar-label">{u.name}</div>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        style={{ width: `${(u.avg / maxBar) * 100}%` }}
                      >
                        {u.avg}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* GRADE DONUT */}
            <div style={{ marginTop: 16 }}>
              <div className="trend-label">
                📌 Agihan Gred PAJSK Keseluruhan ({data.totalStudents} murid)
              </div>
              <div className="donut-wrap" style={{ justifyContent: 'space-between' }}>
                <Donut dist={data.gradeDist} total={data.totalStudents} />
                <div className="donut-legend">
                  {data.gradeDist.map((g) => (
                    <div className="dl-item" key={g.grade}>
                      <div className="dl-dot" style={{ background: GRADE_COLORS[g.grade] }} />
                      {g.grade} · {GRADE_LABEL[g.grade]} — <b>&nbsp;{g.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="right-col">
          <div className="panel">
            <div className="panel-head ph-green">
              <span className="ph-icon">📍</span> PENYERTAAN MENGIKUT PERINGKAT
            </div>
            <div className="panel-body">
              <div className="trend-label">Bilangan Murid Mengikut Peringkat Tertinggi</div>
              <div className="col-chart">
                {data.levelDist.map((l, i) => (
                  <div className="col-group" key={l.level}>
                    <div
                      className="col-bar"
                      style={{
                        height: `${Math.max((l.count / maxLevel) * 100, 6)}%`,
                        background: `linear-gradient(180deg, ${LEVEL_COLORS[i]}, ${LEVEL_COLORS[i]}cc)`,
                      }}
                    >
                      {l.count}
                    </div>
                    <div className="col-label">{LEVEL_LABEL[l.level]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="bot-row">
        <div className="panel" style={{ flex: 1.1, minWidth: 300 }}>
          <div className="panel-head ph-orange">
            <span className="ph-icon">🌟</span> TOP 5 MURID PAJSK TERBAIK
          </div>
          <div className="panel-body" style={{ padding: '8px 12px' }}>
            <table className="data-table">
              <thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Purata</th><th>Gred</th></tr></thead>
              <tbody>
                {data.topStudents.map((s, i) => (
                  <tr key={i}>
                    <td><span className={`rank-no ${['r1', 'r2', 'r3', 'rn', 'rn'][i]}`}>{i + 1}</span></td>
                    <td>{s.name}</td><td>{s.kelas}</td><td><b>{s.total}</b></td><td>{s.grade}</td>
                  </tr>
                ))}
                {data.topStudents.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>Tiada data markah</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ flex: 1.1, minWidth: 300 }}>
          <div className="panel-head ph-red">
            <span className="ph-icon">⚠️</span> KEHADIRAN RENDAH (PERLU PERHATIAN)
          </div>
          <div className="panel-body" style={{ padding: '8px 12px' }}>
            <table className="data-table">
              <thead><tr><th>#</th><th>Nama</th><th>Unit</th><th>Hadir</th></tr></thead>
              <tbody>
                {data.lowAttendance.map((a, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td><td>{a.name}</td><td>{a.unit}</td>
                    <td><b>{a.present}/{a.total}</b></td>
                  </tr>
                ))}
                {data.lowAttendance.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>Tiada amaran</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ flex: 0.9, minWidth: 240 }}>
          <div className="panel-head ph-teal">
            <span className="ph-icon">🔔</span> AKTIVITI TERKINI
          </div>
          <div className="panel-body">
            <div className="activity-list">
              {data.recentActivities.map((a, i) => (
                <div className="act-item" key={i}>
                  <div className="act-dot" style={{ background: LEVEL_COLORS[i % 5] }} />
                  <div>
                    <div className="act-text">{a.title}</div>
                    <div className="act-time">📅 {a.date || '—'} · {a.status}</div>
                  </div>
                </div>
              ))}
              {data.recentActivities.length === 0 && (
                <p className="page-sub">Tiada aktiviti. Tambah di tab Takwim Aktiviti.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="action-bar" style={{ marginTop: 14 }}>
        <Link to="/murid" className="act-btn btn-murid">👤 Urus Murid</Link>
        <Link to="/muat-turun" className="act-btn btn-excel">📊 Laporan & Eksport</Link>
      </div>
    </>
  )
}

function Stat({ cls, icon, val, label }: { cls: string; icon: string; val: React.ReactNode; label: string }) {
  return (
    <div className={`stat-card ${cls}`}>
      <div className="s-icon">{icon}</div>
      <div className="s-val">{val}</div>
      <div className="s-label">{label}</div>
    </div>
  )
}

function Donut({ dist, total }: { dist: { grade: string; count: number }[]; total: number }) {
  const sum = total || dist.reduce((a, x) => a + x.count, 0)
  let offset = 25
  const segs = dist.map((d) => {
    const pct = sum ? (d.count / sum) * 100 : 0
    const seg = { color: GRADE_COLORS[d.grade], dash: pct, offset }
    offset -= pct
    return seg
  })
  return (
    <svg className="donut-svg" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#ece6fb" strokeWidth="5" />
      {segs.map((s, i) => (
        <circle
          key={i}
          cx="21" cy="21" r="15.9155" fill="none"
          stroke={s.color} strokeWidth="5"
          strokeDasharray={`${s.dash} ${100 - s.dash}`}
          strokeDashoffset={s.offset}
        />
      ))}
      <text x="21" y="24" textAnchor="middle" fontSize="6" fontWeight="700" fill="#311b92">{sum}</text>
    </svg>
  )
}
