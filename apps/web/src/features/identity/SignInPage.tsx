import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { PageShell } from '../../components/PageShell'
import { useAuth } from './AuthContext'
import { PasswordField } from './FormParts'

export function SignInPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requested = location.state?.from
  const destination = typeof requested === 'string' && /^\/(dashboard|help|account|admin|donations|food|claims|deliveries|inbox|trust)(\/|\?|$)/.test(requested) ? requested : '/dashboard'
  if (auth.session) return <Navigate to={destination} replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      await auth.login(String(form.get('email')).trim(), String(form.get('password')))
      navigate(destination, { replace: true })
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  return <PageShell><main id="main" className="container account-page auth-layout">
    <section className="account-intro"><h1>Welcome<br />back.</h1><p>Your community starts with you.</p>
      <p className="intro-detail">Sign in to manage your details and check your role verification.</p>
      <Link className="text-link" to="/register">New here? Create an account</Link>
    </section>
    <section className="form-section" aria-labelledby="sign-in-heading"><h2 id="sign-in-heading">Sign in</h2>
      {location.state?.registered && <p className="notice" role="status">Account created. Sign in to view your verification status.</p>}
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="form-fields">
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={100} autoComplete="email" defaultValue={location.state?.email ?? ''} /></div>
          <PasswordField />
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <button className="button form-submit" type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </fieldset>
      </form>
    </section>
  </main></PageShell>
}
