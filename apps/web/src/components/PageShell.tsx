import type { ReactNode } from 'react'
import { Link } from 'react-router'

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container header-content">
          <Link to="/" className="wordmark" aria-label="Second Table home">Second Table</Link>
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#community">Our community</a>
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
