import { PageShell } from '../../components/PageShell'
import { CommunityPanel } from './CommunityPanel'
import { HowItWorks } from './HowItWorks'
import { Link } from 'react-router'
import { useAuth } from '../identity/AuthContext'

export function WelcomePage() {
  const { session } = useAuth()
  return (
    <PageShell>
      <main id="main">
        <div className="container hero">
          <section className="welcome" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading">Good food.<br /><span className="headline-line">Better shared.</span></h1>
            <p>Connect surplus food with people nearby. Donate, collect, and deliver within your community.</p>
            <div className="hero-actions"><Link className="button" to={session ? '/account' : '/register'}>{session ? 'Open your account' : 'Join your community'} <span aria-hidden="true">→</span></Link>
              <a className="text-link" href="#how-it-works">See how it works</a></div>
          </section>
          <HowItWorks />
        </div>
        <CommunityPanel />
      </main>
    </PageShell>
  )
}
