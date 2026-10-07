import { PublicImpact } from "./PublicImpact";
import { PageShell } from "../../components/PageShell";
import { CommunityPanel } from "./CommunityPanel";
import { HomeGuidance } from "./HomeGuidance";
import { HowItWorks } from "./HowItWorks";
import { Link } from "react-router";
import { useAuth } from "../identity/AuthContext";

export function WelcomePage() {
  const { session } = useAuth();
  return (
    <PageShell>
      <main id="main">
        <div className="container hero home-hero">
          <section className="welcome" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading">
              Good food.
              <br />
              <span className="headline-line">Better shared.</span>
            </h1>
            <p>
              Connect surplus food with people nearby. Donate, collect, and
              deliver within your community.
            </p>
            <div className="hero-actions">
              <Link
                className="button"
                to={session ? "/dashboard" : "/register"}
              >
                {session ? "Open your dashboard" : "Join your community"}{" "}
                <span aria-hidden="true">→</span>
              </Link>
              <a className="text-link" href="#how-it-works">
                See how it works
              </a>
            </div>
          </section>
          <img
            className="hero-photo"
            src="/images/food-handover-900.webp"
            srcSet="/images/food-handover-480.webp 480w, /images/food-handover-900.webp 900w, /images/food-handover-1448.webp 1448w"
            sizes="(max-width: 800px) 100vw, 50vw"
            width="1448"
            height="1086"
            fetchPriority="high"
            alt="Hands passing a crate of fresh vegetables in a community kitchen"
          />
        </div>
        <PublicImpact />
        <section className="home-purpose">
          <div className="container">
            <h2>A little closer. A lot less waste.</h2>
            <p>
              A meal from your kitchen can make room at someone else’s table.
              <br />
              Second Table brings the handover into one shared place.
            </p>
          </div>
        </section>
        <div className="container home-process">
          <HowItWorks />
        </div>
        <CommunityPanel />
        <HomeGuidance />
      </main>
    </PageShell>
  );
}
