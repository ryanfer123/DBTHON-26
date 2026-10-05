import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../features/identity/AuthContext'

export function PageShell({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container header-content">
          <Link to="/" className="wordmark" aria-label="Second Table home">Second Table</Link>
          <nav aria-label="Main navigation">
            <Link to="/#how-it-works">How it works</Link>
            <Link to="/#community">Our community</Link>
            <NavLink className="nav-account" to={session ? '/account' : '/sign-in'}>{session ? 'Your account' : 'Sign in'}</NavLink>
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container footer-content">
          <Link className="wordmark" to="/">Second Table</Link>
          <span>Food shared locally.</span>
        </div>
      </footer>
    </>
  )
}
