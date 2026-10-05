import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { WelcomePage } from './features/community/WelcomePage'
import { PageShell } from './components/PageShell'
import { AuthProvider } from './features/identity/AuthProvider'
import { AccountGate } from './features/identity/AccountGate'
import { SignInPage } from './features/identity/SignInPage'
import { RegisterPage } from './features/identity/RegisterPage'
import { ProfilePage } from './features/identity/ProfilePage'
import { AdminPage } from './features/identity/AdminPage'

function NavigationEffects() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
      else if (!pathname.startsWith('/community/')) window.scrollTo({ top: 0, behavior: 'instant' })
      document.title = `${pathname === '/register' ? 'Create account' : pathname === '/sign-in' ? 'Sign in' : pathname === '/account' ? 'Your account' : pathname === '/admin' ? 'Community members' : 'Second Table'} · Food shared locally`
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return null
}

export function App() {
  return (
    <AuthProvider><NavigationEffects /><Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/community/:role" element={<WelcomePage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/account" element={<AccountGate><ProfilePage /></AccountGate>} />
      <Route path="/admin" element={<AccountGate admin><AdminPage /></AccountGate>} />
      <Route path="*" element={
        <PageShell><main id="main" className="not-found container">
          <h1>That table isn’t here.</h1>
          <p>The page you’re looking for couldn’t be found.</p>
          <Link className="button" to="/">Back to Second Table</Link>
        </main></PageShell>
      } />
    </Routes></AuthProvider>
  )
}
