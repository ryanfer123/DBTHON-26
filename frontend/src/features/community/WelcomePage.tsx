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
import { BrandMark } from "../../components/BrandMark";
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
          <div className="close-art" aria-hidden="true">
            <BrandMark />
          </div>
          <div className="container">
            <div className="close-intro">
              <div>
                <p className="section-eyebrow">Better things happen together</p>
                <h2 id="close-heading">
                  There’s room
                  <br />
                  at the table.
                </h2>
              </div>
              <div className="close-invitation">
                <p>
                  Good food. Nearby people. A little less waste. Find your way
                  to make a difference in your neighbourhood.
                </p>
                <Link
                  className="button"
                  to={session ? roleLanding(session) : "/register"}
                >
                  {session ? "Go to my workspace" : "Find your place"}{" "}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
            <nav
              className="close-paths"
              aria-label="Ways to join the community"
            >
              {[
                {
                  to: "/donations/new",
                  title: "Share your surplus",
                  text: "Give good food a second home.",
                  number: "01",
                },
                {
                  to: "/food",
                  title: "Find food nearby",
                  text: "Connect with food in your community.",
                  number: "02",
                },
                {
                  to: "/deliveries",
                  title: "Lend a helping hand",
                  text: "Help a meal reach its next table.",
                  number: "03",
                },
              ].map((item) => (
                <Link key={item.to} to={item.to}>
                  <span className="close-path-top" aria-hidden="true">
                    <span>{item.number}</span>
                    <span>↗</span>
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </Link>
              ))}
            </nav>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
