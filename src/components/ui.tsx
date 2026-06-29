import { ReactNode } from 'react'

export function Loading() {
  return <div className="loading">Memuatkan…</div>
}

export function EmptyState({
  icon = '📭',
  text = 'Tiada rekod lagi.',
}: {
  icon?: string
  text?: string
}) {
  return (
    <div className="empty-state">
      <div className="es-ic">{icon}</div>
      <div className="es-text">{text}</div>
    </div>
  )
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function Pager({
  page,
  total,
  pageSize,
  onPage,
  label = 'rekod',
}: {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  label?: string
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pager">
      <div className="pager-info">
        {total} {label} · halaman {page}/{lastPage}
      </div>
      <div className="pager-btns">
        <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Sebelum</button>
        <button className="btn btn-sm btn-ghost" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Seterus →</button>
      </div>
    </div>
  )
}

export function LevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    sekolah: 'b-grey',
    daerah: 'b-blue',
    negeri: 'b-green',
    kebangsaan: 'b-orange',
    antarabangsa: 'b-red',
  }
  return <span className={`badge ${map[level] || 'b-grey'}`}>{level}</span>
}

export function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, string> = {
    A: 'b-green',
    B: 'b-blue',
    C: 'b-gold',
    D: 'b-orange',
    E: 'b-red',
  }
  return <span className={`badge ${map[grade] || 'b-grey'}`}>{grade}</span>
}
