import { useEffect, useRef } from "react";

const PHRASE = "NOMNOM · LESS WASTE ·\u00a0";
const REPEAT_COUNT = 10;
const REPEATED_TEXT = PHRASE.repeat(REPEAT_COUNT);
const TEXT_WIDTH_RATIO = 0.72;

const RIBBON_PATH =
  "M-71 371.6C126.3 260 593.5 65.8 934.5 80.8c313 13.8 497 136 572 200";

export function CurvedMarquee() {
  const textPathRef = useRef<SVGTextPathElement | null>(null);
  const phraseRef = useRef<SVGTSpanElement | null>(null);
  const phraseWidthRef = useRef(350);

  useEffect(() => {
    const textPath = textPathRef.current;
    if (!textPath) return;

    const measurePhrase = () => {
      if (
        phraseRef.current &&
        typeof phraseRef.current.getComputedTextLength === "function"
      ) {
        try {
          phraseRef.current.removeAttribute("textLength");
          phraseRef.current.removeAttribute("lengthAdjust");
          const width = phraseRef.current.getComputedTextLength();
          if (width && Number.isFinite(width) && width > 0) {
            const fittedWidth = width * TEXT_WIDTH_RATIO;
            phraseRef.current.setAttribute("textLength", `${fittedWidth}`);
            phraseRef.current.setAttribute("lengthAdjust", "spacingAndGlyphs");
            phraseWidthRef.current = fittedWidth / REPEAT_COUNT;
          }
        } catch {
          phraseWidthRef.current = 350;
        }
      }
    };

    measurePhrase();
    void document.fonts?.ready.then(measurePhrase);
    window.addEventListener("resize", measurePhrase);

    const hasMatchMedia =
      typeof window !== "undefined" && typeof window.matchMedia === "function";
    const reduceMotion =
      hasMatchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let lastTime = performance.now();
    let distance = 0;
    let frameId = 0;
    let targetScroll =
      typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0;
    let currentScroll = targetScroll;
    let ambientDirection = -1;

    const onScroll = () => {
      targetScroll = window.scrollY || window.pageYOffset || 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Wheel reversal when sitting at the top of the page
    const onWheel = (e: WheelEvent) => {
      if (targetScroll <= 2 && e.deltaY < -1) {
        ambientDirection = 1;
        distance -= Math.min(Math.abs(e.deltaY) * 0.4, 25);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });

    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth scroll tracking
      const scrollDelta = targetScroll - currentScroll;
      const scrollStep = scrollDelta * 0.14;
      currentScroll += scrollStep;

      // Reversal: scrolling down accelerates forward (-), scrolling up accelerates backward (+)
      if (scrollStep > 0.3) {
        ambientDirection = -1;
      } else if (scrollStep < -0.3) {
        ambientDirection = 1;
      }

      const scrollPush = scrollStep * 0.85;
      const ambientStep = reduceMotion ? 0 : -ambientDirection * 44 * delta;

      distance += scrollPush + ambientStep;
      const period = phraseWidthRef.current || 350;
      const offset = ((distance % period) + period) % period;
      textPath.setAttribute("startOffset", `${-offset}px`);

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", measurePhrase);
    };
  }, []);

  return (
    <section
      className="curved-marquee-section"
      aria-label="NomNom. Less waste."
    >
      <h2 className="curved-marquee-heading" aria-label="NomNom. Less waste.">
        <span className="sr-only">NomNom. Less waste.</span>
        <svg
          className="curved-marquee-bg-svg"
          viewBox="0 0 1440 442"
          role="presentation"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <path className="curved-marquee-ribbon" d={RIBBON_PATH} />
        </svg>
        <svg
          className="curved-marquee-text-svg"
          viewBox="0 0 1440 442"
          role="presentation"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <path id="curved-marquee-text-path" d={RIBBON_PATH} />
          </defs>
          <text className="curved-marquee-text" dominantBaseline="middle">
            <textPath
              ref={textPathRef}
              href="#curved-marquee-text-path"
              startOffset="0px"
            >
              <tspan ref={phraseRef}>{REPEATED_TEXT}</tspan>
            </textPath>
          </text>
        </svg>
      </h2>
    </section>
  );
}
