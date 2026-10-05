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
import { FoodDetailPage, FoodPage, ListingEditorPage } from './features/workflows/FoodPages'
import { DeliveriesPage, ExchangeDetailPage, ExchangesPage } from './features/workflows/ExchangePages'
import { ImpactPage, InboxPage, TrustPage } from './features/workflows/CommunityPages'
import { Access } from './features/workflows/Workspace'

function NavigationEffects() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      else if (!pathname.startsWith('/community/')) window.scrollTo({ top: 0, behavior: 'instant' })
      const titles: Record<string, string> = { '/register': 'Create account', '/sign-in': 'Sign in', '/account': 'Your account', '/admin': 'Community members', '/donations': 'My donations', '/donations/new': 'Share some food', '/food': 'Find nearby food', '/claims': 'My exchanges', '/deliveries': 'Your deliveries', '/inbox': 'Your inbox', '/trust': 'Your trust history', '/admin/exchanges': 'Review exchanges', '/admin/impact': 'Community impact' }
      document.title = `${titles[pathname] ?? 'Second Table'} · Food shared locally`
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
      <Route path="/donations" element={<AccountGate><Access roles={['Donor']}><FoodPage own /></Access></AccountGate>} />
      <Route path="/donations/new" element={<AccountGate><Access roles={['Donor']}><ListingEditorPage /></Access></AccountGate>} />
      <Route path="/donations/:id/edit" element={<AccountGate><Access roles={['Donor']}><ListingEditorPage /></Access></AccountGate>} />
      <Route path="/food" element={<AccountGate><Access roles={['Receiver']}><FoodPage /></Access></AccountGate>} />
      <Route path="/food/:id" element={<AccountGate><FoodDetailPage /></AccountGate>} />
      <Route path="/claims" element={<AccountGate><Access roles={['Donor', 'Receiver']}><ExchangesPage /></Access></AccountGate>} />
      <Route path="/claims/:id" element={<AccountGate><ExchangeDetailPage /></AccountGate>} />
      <Route path="/deliveries" element={<AccountGate><DeliveriesPage /></AccountGate>} />
      <Route path="/inbox" element={<AccountGate><InboxPage /></AccountGate>} />
      <Route path="/trust" element={<AccountGate><TrustPage /></AccountGate>} />
      <Route path="/admin/exchanges" element={<AccountGate admin><ExchangesPage admin /></AccountGate>} />
      <Route path="/admin/impact" element={<AccountGate admin><ImpactPage /></AccountGate>} />
      <Route path="/admin/users/:userId/audit" element={<AccountGate admin><TrustPage /></AccountGate>} />
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
