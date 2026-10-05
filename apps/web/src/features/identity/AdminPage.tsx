import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { PageShell } from '../../components/PageShell'
import { api, ApiError, type Page, type PublicRole, type User } from '../../lib/identity'
import { useAuth } from './AuthContext'

function ReviewForm({ user, onComplete }: { user: User; onComplete: () => void }) {
  const auth = useAuth()
  const requested = user.roles.filter(item => item.role !== 'Admin')
  const [roles, setRoles] = useState<PublicRole[]>(requested.filter(item => item.approved).map(item => item.role as PublicRole))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
    if (action !== 'revoke' && !roles.length) { setError('Select at least one requested role to approve.'); return }
    setBusy(true); setError('')
    try {
      await api<{ data: User }>(`/admin/users/${user.user_id}/verify`, { method: 'POST', csrf: auth.session!.csrf_token,
        body: { verified: action !== 'revoke', roles: action === 'revoke' ? [] : roles, reason: String(form.get('reason')).trim() } })
      onComplete()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) auth.expire()
      else setError((error as Error).message)
    } finally { setBusy(false) }
  }
  return <form className="review-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy} className="form-fields">
    <fieldset className="review-roles"><legend>Approved roles</legend>
      <p className="field-help">This selection replaces the member’s current public role approvals.</p>
      {requested.map(item => <label className="review-check" key={item.role}><input type="checkbox" checked={roles.includes(item.role as PublicRole)}
        onChange={event => setRoles(current => event.target.checked ? [...current, item.role as PublicRole] : current.filter(role => role !== item.role))} />{item.role}</label>)}
    </fieldset>
    <div className="field"><label htmlFor={`reason-${user.user_id}`}>Review reason</label><textarea id={`reason-${user.user_id}`} name="reason" required minLength={3} maxLength={300} rows={3} />
      <small>Record why the roles are approved or revoked. Required for every review.</small></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="actions"><button className="button button-small" type="submit" value="approve">{busy ? 'Saving review…' : 'Save approval'}</button>
      {user.verified_status && <button className="button button-outline button-small" type="submit" value="revoke">Revoke verification</button>}
    </div>
  </fieldset></form>
}

export function AdminPage() {
  const { expire } = useAuth()
  const [filter, setFilter] = useState('pending')
  const [cursor, setCursor] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ loading: boolean; error: string; page: Page<User> | null }>({ loading: true, error: '', page: null })
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const query = filter === 'all' ? '' : `&verified=${filter === 'verified'}`
    api<Page<User>>(`/admin/users?limit=20&cursor=${cursor}${query}`, { signal: controller.signal }).then(page => {
      if (!controller.signal.aborted) setState({ loading: false, error: '', page })
    }).catch(error => {
      if (!controller.signal.aborted) {
        if (error instanceof ApiError && error.status === 401) expire()
        else setState({ loading: false, error: error.message, page: null })
      }
    })
    return () => controller.abort()
  }, [filter, cursor, attempt, expire])
  const reload = () => { setState({ loading: true, error: '', page: null }); setReviewing(null); setAttempt(value => value + 1) }
  return <PageShell><main id="main" className="container account-page">
    <div className="page-heading"><div><h1>Community members</h1><p>Review requested roles in your community area.</p></div><Link className="text-link" to="/account">Back to your account</Link></div>
    <div className="admin-toolbar"><div className="field"><label htmlFor="member-filter">Show members</label><select id="member-filter" value={filter} onChange={event => {
      setFilter(event.target.value); setCursor(0); setReviewing(null); setNotice(''); setState({ loading: true, error: '', page: null })
    }}><option value="pending">Awaiting verification</option><option value="verified">Verified</option><option value="all">All members</option></select></div>
      <button className="text-button" onClick={reload} disabled={state.loading}>Refresh members</button>
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {state.loading ? <p role="status" className="list-message">Loading members…</p> : state.error ? <div className="notice notice-error" role="alert"><p>{state.error}</p><button className="button button-small" onClick={reload}>Try again</button></div> :
      <><ul className="member-list">{state.page?.data.map(user => <li key={user.user_id} className="member-row">
        <div className="member-info"><h2>{user.name}</h2><p>{user.email}</p><p>{user.phone}</p><p className="field-help">{user.roles.map(item => `${item.role}: ${item.approved ? 'approved' : 'pending'}`).join(' · ')}{user.capacity_kg ? ` · Capacity: ${user.capacity_kg} kg` : ''}</p></div>
        <span className="member-status">{user.verified_status ? 'Verified' : 'Awaiting review'}</span>
        {user.roles.some(item => item.role !== 'Admin') && <button className="button button-outline button-small" aria-expanded={reviewing === user.user_id} aria-controls={`review-${user.user_id}`}
          onClick={() => setReviewing(current => current === user.user_id ? null : user.user_id)}>{reviewing === user.user_id ? 'Close review' : 'Review member'}</button>}
        {reviewing === user.user_id && <div id={`review-${user.user_id}`} className="review-panel"><h3>Review {user.name}</h3><ReviewForm user={user} onComplete={() => { setNotice(`Review saved for ${user.name}.`); reload() }} /></div>}
      </li>)}</ul>
      {!state.page?.data.length && <p className="list-message">No members match this view.</p>}
      <div className="actions pagination">{cursor > 0 && <button className="text-button" onClick={() => { setCursor(0); reload() }}>Back to first page</button>}
        {state.page?.meta.next_cursor != null && <button className="button button-small" onClick={() => { setCursor(state.page!.meta.next_cursor!); reload() }}>Next page</button>}
      </div></>}
  </main></PageShell>
}
