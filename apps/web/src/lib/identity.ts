export type PublicRole = 'Donor' | 'Receiver' | 'Volunteer'
export type User = {
  user_id: number; zone_id: number; name: string; email: string; phone: string
  latitude: string; longitude: string; verified_status: boolean; active: boolean
  roles: { role: PublicRole | 'Admin'; approved: boolean }[]
  capabilities: (PublicRole | 'Admin')[]; capacity_kg: string | null
}
export type Session = { user: User; csrf_token: string }
export type Zone = { zone_id: number; zone_name: string; city: string }
export type Page<T> = { data: T[]; meta: { next_cursor: number | null } }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export async function api<T>(path: string, options: {
  method?: 'POST' | 'PATCH'; body?: unknown; csrf?: string; key?: string; signal?: AbortSignal
  conditional?: { etag: string; value: T }; onResult?: (value: T, etag: string | null) => void
} = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET', credentials: 'include', signal: options.signal,
      headers: options.method ? {
        'Content-Type': 'application/json', 'X-Requested-With': 'SecondTable',
        ...(options.csrf ? { 'X-CSRF-Token': options.csrf } : {}),
        ...(options.key ? { 'Idempotency-Key': options.key } : {}),
      } : options.conditional ? { 'If-None-Match': options.conditional.etag } : undefined,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(0, 'Couldn’t connect. Check your connection and try again.')
  }
  if (response.status === 304 && options.conditional) return options.conditional.value
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = response.status === 429
      ? `Too many attempts. Try again in ${response.headers.get('Retry-After') ?? '60'} seconds.`
      : response.status === 422 ? 'Check the fields and try again. Your details could not be accepted.'
        : payload?.error?.message ?? 'Something went wrong. Please try again.'
    throw new ApiError(response.status, message)
  }
  const value: T = response.status === 204 ? undefined as T : await response.json()
  options.onResult?.(value, response.headers.get('ETag'))
  return value
}

export async function loadZones(signal: AbortSignal): Promise<Zone[]> {
  const zones: Zone[] = []
  let cursor = 0
  for (;;) {
    const page = await api<Page<Zone>>(`/zones?limit=100&cursor=${cursor}`, { signal })
    zones.push(...page.data)
    if (page.meta.next_cursor === null) return zones
    if (page.meta.next_cursor <= cursor) throw new ApiError(0, 'Community areas could not load. Please try again.')
    cursor = page.meta.next_cursor
  }
}
