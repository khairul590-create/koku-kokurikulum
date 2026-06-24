import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, qs } from './api'

// Generic list hook for a REST resource with optional query params.
export function useList<T>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
) {
  return useQuery({
    queryKey: [resource, params],
    queryFn: () => api.get<T[]>(`/${resource}${qs(params)}`),
  })
}

export function useCreate<T>(resource: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<T>) => api.post<T>(`/${resource}`, body),
    onSuccess: () => invalidateAll(qc, resource),
  })
}

export function useUpdate<T>(resource: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<T> }) =>
      api.put<T>(`/${resource}/${id}`, body),
    onSuccess: () => invalidateAll(qc, resource),
  })
}

export function useDelete(resource: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/${resource}/${id}`),
    onSuccess: () => invalidateAll(qc, resource),
  })
}

// Resource changes can affect dashboard stats + reports, so invalidate widely.
function invalidateAll(
  qc: ReturnType<typeof useQueryClient>,
  resource: string,
) {
  qc.invalidateQueries({ queryKey: [resource] })
  qc.invalidateQueries({ queryKey: ['stats'] })
  qc.invalidateQueries({ queryKey: ['report'] })
}
