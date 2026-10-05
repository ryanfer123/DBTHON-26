export type RoleId = 'donor' | 'receiver' | 'volunteer'
export type RoleIntroduction = { id: RoleId; name: string; description: string }
export type Community = { name: string; roles: RoleIntroduction[] }

const roleIds: RoleId[] = ['donor', 'receiver', 'volunteer']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function loadCommunity(signal: AbortSignal): Promise<Community> {
  const response = await fetch('/api/v1/community', { signal, credentials: 'same-origin' })
  if (!response.ok) throw new Error('Community information is unavailable.')
  const body: unknown = await response.json()
  if (!isRecord(body) || !isRecord(body.data) || typeof body.data.name !== 'string'
    || !Array.isArray(body.data.roles)) throw new Error('Invalid community response.')
  const roles = body.data.roles.map((item: unknown): RoleIntroduction => {
    if (!isRecord(item) || !roleIds.includes(item.id as RoleId)
      || typeof item.name !== 'string' || typeof item.description !== 'string') {
      throw new Error('Invalid community role.')
    }
    return { id: item.id as RoleId, name: item.name, description: item.description }
  })
  if (roles.length !== 3 || new Set(roles.map(r => r.id)).size !== 3) {
    throw new Error('Incomplete community response.')
  }
  return { name: body.data.name, roles }
}
