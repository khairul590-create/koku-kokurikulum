// Shared domain types used by both the API and the front-end.

export type UnitKind = 'kelab' | 'beruniform' | 'sukan'
export const UNIT_KINDS: UnitKind[] = ['kelab', 'beruniform', 'sukan']
export const UNIT_KIND_LABEL: Record<UnitKind, string> = {
  kelab: 'Kelab & Persatuan',
  beruniform: 'Pasukan Beruniform',
  sukan: 'Sukan & Permainan',
}

export type Level =
  | 'sekolah'
  | 'daerah'
  | 'negeri'
  | 'kebangsaan'
  | 'antarabangsa'
export const LEVELS: Level[] = [
  'sekolah',
  'daerah',
  'negeri',
  'kebangsaan',
  'antarabangsa',
]
export const LEVEL_LABEL: Record<Level, string> = {
  sekolah: 'Sekolah',
  daerah: 'Daerah / Zon',
  negeri: 'Negeri',
  kebangsaan: 'Kebangsaan',
  antarabangsa: 'Antarabangsa',
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Unit {
  id: string
  name: string
  kind: UnitKind
  advisor: string | null
  created_at: string
}

export interface Student {
  id: string
  name: string
  kelas: string
  tahun: number
  created_at: string
}

export interface Enrollment {
  id: string
  student_id: string
  unit_id: string
  role: string | null
  highest_level: Level
  created_at: string
  // joined (optional)
  student?: Student
  unit?: Unit
}

export interface Attendance {
  id: string
  student_id: string
  unit_id: string
  week: number
  present: boolean
  session: string
  created_at: string
  student?: Student
  unit?: Unit
}

export interface PajskScore {
  id: string
  student_id: string
  unit_id: string
  session: string
  m_kehadiran: number
  m_jawatan: number
  m_penglibatan: number
  m_pencapaian: number
  total: number
  grade: Grade
  created_at: string
  student?: Student
  unit?: Unit
}

export interface Achievement {
  id: string
  student_id: string | null
  unit_id: string | null
  title: string
  level: Level
  position: string | null
  date: string | null
  created_at: string
  student?: Student
  unit?: Unit
}

export interface Activity {
  id: string
  title: string
  date: string | null
  unit_id: string | null
  description: string | null
  status: string
  created_at: string
  unit?: Unit
}

export interface DashboardStats {
  totalStudents: number
  totalUnits: number
  participationPct: number
  avgPajsk: number
  totalAchievements: number
  attendancePct: number
  komponen: { kind: UnitKind; units: number; students: number; avg: number }[]
  unitAverages: { name: string; kind: UnitKind; avg: number }[]
  gradeDist: { grade: Grade; count: number }[]
  levelDist: { level: Level; count: number }[]
  topStudents: { name: string; kelas: string; total: number; grade: Grade }[]
  lowAttendance: {
    name: string
    unit: string
    present: number
    total: number
  }[]
  recentActivities: { title: string; date: string | null; status: string }[]
}

// Grade derivation shared everywhere so UI + API agree.
export function gradeFromTotal(total: number): Grade {
  if (total >= 80) return 'A'
  if (total >= 60) return 'B'
  if (total >= 40) return 'C'
  if (total >= 20) return 'D'
  return 'E'
}

export const GRADE_LABEL: Record<Grade, string> = {
  A: 'Cemerlang',
  B: 'Baik',
  C: 'Memuaskan',
  D: 'Lemah',
  E: 'Lemah Sekali',
}
