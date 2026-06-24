import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, qs } from '../lib/api'
import { Student } from '../../shared/types'

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

interface Props {
  value: string
  onChange: (id: string, student?: Student) => void
  placeholder?: string
}

// Type-ahead picker that searches students server-side (scales to thousands).
export function StudentPicker({ value, onChange, placeholder }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const dq = useDebounce(q, 250)

  const results = useQuery({
    queryKey: ['students', 'pick', dq],
    queryFn: () =>
      api.get<Student[]>(`/students${qs({ q: dq || undefined, limit: 20 })}`),
    enabled: open,
  })
  const selected = useQuery({
    queryKey: ['students', 'one', value],
    queryFn: () => api.get<Student>(`/students/${value}`),
    enabled: !!value,
  })

  const label = selected.data
    ? `${selected.data.name}${selected.data.kelas ? ` (${selected.data.kelas})` : ''}`
    : ''

  return (
    <div className="picker">
      <input
        className="picker-input"
        value={open ? q : label}
        placeholder={placeholder || 'Cari & pilih murid…'}
        onFocus={() => {
          setOpen(true)
          setQ('')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div className="picker-list">
          {results.isLoading && <div className="picker-item muted">Mencari…</div>}
          {!results.isLoading && (results.data?.length ?? 0) === 0 && (
            <div className="picker-item muted">Tiada padanan</div>
          )}
          {(results.data ?? []).map((s) => (
            <div
              key={s.id}
              className="picker-item"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(s.id, s)
                setOpen(false)
                setQ('')
              }}
            >
              {s.name} <span className="muted">({s.kelas || '—'})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
