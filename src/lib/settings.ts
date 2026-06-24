import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export interface KokuSettings {
  profile: { name: string; jawatan: string; phone: string; email: string }
  school: {
    name: string
    code: string
    address: string
    daerah: string
    negeri: string
    session: string
    motto: string
  }
  leadership: { guruBesar: string; gpkKoko: string; penyelaras: string }
  announcement: { text: string; active: boolean }
}

export const DEFAULT_SETTINGS: KokuSettings = {
  profile: { name: 'Cikgu Azwani', jawatan: 'GPK Kokurikulum', phone: '', email: '' },
  school: {
    name: 'SK Darau',
    code: '',
    address: '',
    daerah: 'Kota Kinabalu',
    negeri: 'Sabah',
    session: '2026',
    motto: 'Bina Sahsiah, Lahir Pemimpin',
  },
  leadership: { guruBesar: '', gpkKoko: '', penyelaras: '' },
  announcement: { text: '', active: false },
}

// Merge stored (possibly partial / legacy) settings onto defaults so the UI
// always has every field, regardless of what's in the DB jsonb.
export function mergeSettings(raw: unknown): KokuSettings {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = raw ?? {}
  const d = DEFAULT_SETTINGS
  // Legacy shape stored {school: "SK Darau", session: "2026"} as flat strings.
  const legacySchool =
    typeof r.school === 'string'
      ? typeof r.session === 'string'
        ? { name: r.school, session: r.session }
        : { name: r.school }
      : r.school
  return {
    profile: { ...d.profile, ...(r.profile ?? {}) },
    school: { ...d.school, ...(legacySchool ?? {}) },
    leadership: { ...d.leadership, ...(r.leadership ?? {}) },
    announcement: { ...d.announcement, ...(r.announcement ?? {}) },
  }
}

export function useSettings() {
  const q = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<unknown>('/settings'),
    staleTime: 60_000,
  })
  return { settings: mergeSettings(q.data), raw: q.data, isLoading: q.isLoading }
}
