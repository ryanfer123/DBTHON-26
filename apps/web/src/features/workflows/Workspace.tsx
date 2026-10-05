import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { PageShell } from '../../components/PageShell'
import { useAuth } from '../identity/AuthContext'
import type { Meta } from './data'
import type { User } from '../../lib/identity'

export function WorkspaceNav() {
  const { session } = useAuth()
  const roles = session?.user.capabilities ?? []
  return <nav className="workspace-nav" aria-label="Community workspace">
    {roles.includes('Donor') && <NavLink to="/donations">My donations</NavLink>}
    {roles.includes('Receiver') && <NavLink to="/food">Find food</NavLink>}
    {(roles.includes('Donor') || roles.includes('Receiver')) && <NavLink to="/claims">My exchanges</NavLink>}
    {roles.includes('Volunteer') && <NavLink to="/deliveries">Deliveries</NavLink>}
    <NavLink to="/inbox">Inbox</NavLink><NavLink to="/trust">My trust</NavLink>
    {roles.includes('Admin') && <><NavLink to="/admin" end>Members</NavLink><NavLink to="/admin/exchanges">Exchange review</NavLink><NavLink to="/admin/impact">Impact report</NavLink></>}
  </nav>
}
export function Workspace({ title, intro, action, children }: { title: string; intro: string; action?: ReactNode; children: ReactNode }) {
  return <PageShell><main id="main" className="container account-page workspace">
    <div className="page-heading"><div><h1>{title}</h1><p>{intro}</p></div>{action}</div>
    <WorkspaceNav />{children}
  </main></PageShell>
}
export function Access({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { session } = useAuth()
  return roles.some(role => session?.user.capabilities.includes(role as User['capabilities'][number])) ? children :
    <Workspace title="Your community workspace" intro="Role approval opens your food-sharing tools.">
      <p className="notice">This view requires an approved {roles.join(' or ')} role. Your administrator reviews requested roles.</p>
      <Link className="button button-small" to="/account">Check your verification status</Link>
    </Workspace>
}
export function QueryStatus({ loading, error, refresh }: { loading: boolean; error: string; refresh: () => void }) {
  return loading ? <p className="list-message" role="status">Loading your community…</p> : error ?
    <div className="notice notice-error" role="alert"><p>{error}</p><button className="button button-small" onClick={refresh}>Try again</button></div> : null
}
export function Feedback({ error, notice }: { error: string; notice: string }) {
  return <>{error && <p className="notice notice-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}</>
}
export function Pagination({ meta, cursor, setCursor }: { meta?: Meta; cursor: string | number | null; setCursor: (cursor: string | number | null) => void }) {
  return <div className="actions pagination">{cursor != null && cursor !== 0 && <button className="text-button" onClick={() => setCursor(null)}>Back to first page</button>}
    {meta?.next_cursor != null && <button className="button button-small button-outline" onClick={() => setCursor(meta.next_cursor)}>Next page</button>}
  </div>
}
export function Countdown({ end, serverTime }: { end: string; serverTime: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = performance.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [end, serverTime])
  const remaining = Math.max(0, Math.floor((Date.parse(end) - Date.parse(serverTime)) / 1000) - elapsed)
  return <span className={`countdown ${remaining <= 1800 ? 'urgent' : ''}`}>{remaining ? `${Math.ceil(remaining / 60)} min remaining` : 'Deadline reached'}</span>
}
export function Coordinates({ lat, lon }: { lat: string; lon: string }) {
  return <span className="coordinates">{lat}, {lon}</span>
}
