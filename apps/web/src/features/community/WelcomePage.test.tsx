import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { App } from '../../App'

const roles = [
  { id: 'donor', name: 'Donors', description: 'Share surplus with a clear collection window.' },
  { id: 'receiver', name: 'Receivers', description: 'Find food that fits your capacity.' },
  { id: 'volunteer', name: 'Volunteers', description: 'Collect and deliver food nearby.' },
]

function mount(path = '/') {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('public community flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async path => String(path).endsWith('/auth/session')
      ? { ok: true, status: 200, json: async () => ({ data: null }) }
      : { ok: true, json: async () => ({ data: { name: 'Second Table', roles } }) }))
  })

  it('switches between API-provided role descriptions with keyboard navigation', async () => {
    mount()
    expect(await screen.findByRole('tab', { name: 'Donors' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Receivers' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Find food that fits your capacity.')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Volunteers' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Collect and deliver food nearby.')
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).endsWith('/community'))).toHaveLength(1)
  })

  it('restores a role from its direct URL', async () => {
    mount('/community/volunteer')
    expect(await screen.findByRole('tab', { name: 'Volunteers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Collect and deliver food nearby.')
  })

  it('shows a recoverable failure instead of presenting offline content as live', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!
    let offline = true
    vi.mocked(fetch).mockImplementation((...args) => {
      if (String(args[0]).endsWith('/community') && offline) { offline = false; return Promise.reject(new Error('offline')) }
      return original(...args)
    })
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t load')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('tab', { name: 'Donors' })).toBeVisible()
  })

  it('shows a useful missing-page view', () => {
    mount('/missing')
    expect(screen.getByRole('heading', { name: 'That table isn’t here.' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to Second Table' })).toHaveAttribute('href', '/')
  })
})
