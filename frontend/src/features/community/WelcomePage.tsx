import { PublicImpact } from "./PublicImpact";
import { PageShell } from "../../components/PageShell";
import { CommunityPanel } from "./CommunityPanel";
import { HomeGuidance } from "./HomeGuidance";
import { HowItWorks } from "./HowItWorks";
import { Link } from "react-router";
import { useAuth } from "../identity/AuthContext";
import { roleLanding } from "../../lib/session-routing";
import { MarketingMotion } from "./MarketingMotion";
import { CurvedMarquee } from "./CurvedMarquee";
import { StageHero } from "./StageHero";

export function WelcomePage() {
  const { session } = useAuth();
  return (
    <PageShell variant="marketing">
      <MarketingMotion />
      <main id="main" className="marketing-home">
        <StageHero />
        <PublicImpact />
        <CurvedMarquee />
        <div className="container home-process marketing-story">
          <HowItWorks />
        </div>
        <CommunityPanel />
        <HomeGuidance />
        <section className="marketing-close" aria-labelledby="close-heading">
          <div className="container">
            <p className="section-eyebrow">Better things happen together</p>
            <h2 id="close-heading">There’s room at the table.</h2>
            <p>
              Join the people making good food go a little further in their
              neighbourhood.
            </p>
            <Link
              className="button"
              to={session ? roleLanding(session) : "/register"}
            >
              {session ? "Go to my workspace" : "Find your place"}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
