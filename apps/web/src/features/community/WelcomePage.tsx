import { PageShell } from '../../components/PageShell'
import { CommunityPanel } from './CommunityPanel'
import { HowItWorks } from './HowItWorks'

export function WelcomePage() {
  return (
    <PageShell>
      <main id="main">
        <div className="container hero">
          <section className="welcome" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading">Good food.<br /><span className="headline-line">Better shared.</span></h1>
            <p>Connect surplus food with people nearby. Donate, collect, and deliver within your community.</p>
            <a className="button" href="#how-it-works">See how it works <span aria-hidden="true">→</span></a>
          </section>
          <HowItWorks />
        </div>
        <CommunityPanel />
      </main>
    </PageShell>
  )
}
