import { useEffect, useRef } from "react";
import { Link } from "react-router";
import gsap from "gsap";
import { useAuth } from "../identity/AuthContext";
import { roleLanding } from "../../lib/session-routing";

const STAGE_TITLE_PATHS = [
  { id: "nomnom-n-1", d: "M150 510V120L410 510V120", strokeWidth: 112, offset: 0 },
  {
    id: "nomnom-o-1",
    d: "M480 315C480 190 565 120 685 120C805 120 890 195 890 315C890 435 805 510 685 510C565 510 480 435 480 315Z",
    strokeWidth: 108,
    offset: 60,
  },
  { id: "nomnom-m-1-stem", d: "M960 510V205", strokeWidth: 112, offset: 120 },
  {
    id: "nomnom-m-1-arches",
    d: "M960 245C960 75 1165 75 1165 245V510M1165 245C1165 75 1370 75 1370 245V510",
    strokeWidth: 112,
    offset: 120,
  },
  { id: "nomnom-n-2", d: "M1450 510V120L1710 510V120", strokeWidth: 112, offset: 180 },
  {
    id: "nomnom-o-2",
    d: "M1780 315C1780 190 1865 120 1985 120C2105 120 2190 195 2190 315C2190 435 2105 510 1985 510C1865 510 1780 435 1780 315Z",
    strokeWidth: 108,
    offset: 240,
  },
  { id: "nomnom-m-2-stem", d: "M2260 510V205", strokeWidth: 112, offset: 300 },
  {
    id: "nomnom-m-2-arches",
    d: "M2260 245C2260 75 2465 75 2465 245V510M2465 245C2465 75 2670 75 2670 245V510",
    strokeWidth: 112,
    offset: 300,
  },
];

export function StageHero() {
  const { session } = useAuth();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const pathEls = svgEl.querySelectorAll<SVGPathElement>(".stage-title-path");
    if (!pathEls.length) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      pathEls.forEach((path) => gsap.set(path, { strokeDashoffset: 0, opacity: 1 }));
      if (ctaRef.current) gsap.set(ctaRef.current, { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    const getPathLength = (path: SVGPathElement) => {
      try {
        return path.getTotalLength() || 1000;
      } catch {
        return 1000;
      }
    };
    pathEls.forEach((path) => {
      const length = getPathLength(path);
      gsap.set(path, { strokeDasharray: length + 1, strokeDashoffset: length + 1, opacity: 1 });
    });

    if (ctaRef.current) {
      gsap.set(ctaRef.current, { opacity: 0, y: 24 });
    }

    pathEls.forEach((path, index) => {
      const length = getPathLength(path);
      tl.to(
        path,
        { strokeDashoffset: 0, duration: Math.max(0.3, Math.min(length / 1400, 0.9)) },
        index === 0 ? 0 : "-=0.12"
      );
    });

    // Pop in the CTA button
    if (ctaRef.current) {
      tl.to(
        ctaRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "back.out(1.4)",
        },
        "-=0.25"
      );
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <section className="stage-hero-section" aria-labelledby="welcome-heading">
      {/* Background stipple noise texture overlay */}
      <div className="stage-noise-overlay" aria-hidden="true" />

      <div className="stage-hero-container">
        {/* NomNom hero wordmark */}
        <div className="stage-logo-wrap">
          <h1 id="welcome-heading" className="stage-logo-heading" aria-label="NomNom">
            <span className="sr-only">NomNom</span>
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 3250 700"
              className="stage-logo-svg"
              role="presentation"
              aria-hidden="true"
              preserveAspectRatio="xMidYMid meet"
            >
              <g className="stage-title-paths">
                {STAGE_TITLE_PATHS.map((item) => (
                  <path
                    key={item.id}
                    className={`stage-title-path ${item.id}`}
                    d={item.d}
                    transform={`translate(${item.offset} 0)`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={item.strokeWidth}
                    strokeLinecap="square"
                    strokeLinejoin="round"
                    style={{ opacity: 0 }}
                  />
                ))}
                <circle className="stage-title-period" cx="3098" cy="490" r="52" />
              </g>
            </svg>
          </h1>
        </div>

        {/* CTA Button matching reference structure with 'Join community' */}
        <div ref={ctaRef} className="hero-actions stage-cta">
          <Link
            className="button stage-button"
            to={session ? roleLanding(session) : "/register"}
          >
            <div className="button-cycle is-first" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 10 10"
                className="button-arrow"
              >
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M0 1.827 1.71 0H10v8.22L8.11 10V5.93c0-.992.009-1.89.03-2.695l-6.642 6.58-1.316-1.44 6.641-6.58c-.787.022-1.67.032-2.647.032H0Z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="button-cycle-bg" />
            </div>
            <div className="button-bg">
              <span className="button-text">
                {session ? "Open your workspace" : "Join community"}
              </span>
            </div>
            <div className="button-cycle is-second" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 10 10"
                className="button-arrow"
              >
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M0 1.827 1.71 0H10v8.22L8.11 10V5.93c0-.992.009-1.89.03-2.695l-6.642 6.58-1.316-1.44 6.641-6.58c-.787.022-1.67.032-2.647.032H0Z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="button-cycle-bg" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
