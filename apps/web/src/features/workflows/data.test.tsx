import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthContext, type Auth } from '../identity/AuthContext'
import { useCommand } from './data'

const auth: Auth = {
  session: { csrf_token: 'test-csrf', user: { user_id: 101, zone_id: 1, name: 'Synthetic Donor', email: 'donor@example.invalid', phone: '+12025550101', latitude: '12.969200', longitude: '79.155900', verified_status: true, active: true, roles: [{ role: 'Donor', approved: true }], capabilities: ['Donor'], capacity_kg: null } },
  loading: false, error: null, refresh: vi.fn(), login: vi.fn(), logout: vi.fn(), update: vi.fn(), expire: vi.fn(),
}
function wrapper({ children }: { children: ReactNode }) { return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider> }
it('reuses the attempt key after a lost response, but gives a new successful intent its own key', async () => {
  const mock = vi.fn().mockRejectedValueOnce(new TypeError('network lost'))
    .mockImplementation(async () => new Response(JSON.stringify({ data: { listing_id: 501 } }), { status: 201 }))
  vi.stubGlobal('fetch', mock)
  const { result } = renderHook(useCommand, { wrapper })
  await act(async () => { expect(await result.current.run('/listings', { food_type: 'Synthetic food' })).toBeNull() })
  expect(result.current.error).toContain('Couldn’t connect')
  await act(async () => { expect(await result.current.run('/listings', { food_type: 'Synthetic food' })).not.toBeNull() })
  await act(async () => { await result.current.run('/listings', { food_type: 'Synthetic food' }) })
  const headers = mock.mock.calls.map(([, options]) => options.headers)
  expect(headers[0]['Idempotency-Key']).toBe(headers[1]['Idempotency-Key'])
  expect(headers[2]['Idempotency-Key']).not.toBe(headers[1]['Idempotency-Key'])
  expect(headers[0]['X-CSRF-Token']).toBe('test-csrf')
  expect(result.current.busy).toBe(false)
})
