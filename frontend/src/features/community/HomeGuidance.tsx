import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { questions } from "./helpContent";
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  gsap.registerPlugin(ScrollTrigger);
}
const guidance = [
  {
    step: 1,
    title: "Start with verified roles",
    text: "Your zone administrator reviews requested roles before food can be listed, claimed or delivered.",
  },
  {
    step: 2,
    title: "Make the deadline clear",
    text: "Donors provide preparation times and collection deadlines. Check storage and handling directly before accepting food.",
  },
  {
    step: 3,
    title: "Keep the outcome visible",
    text: "Follow an exchange through pickup and delivery, then leave a rating once it is complete.",
  },
];

export function HomeGuidance() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [pathD, setPathD] = useState("");

  useEffect(() => {
    const updatePath = () => {
      const container = containerRef.current;
      const items = itemRefs.current.filter(Boolean) as HTMLLIElement[];
      if (items.length < 3 || !container) return;

      // Stable vertical alignment: step badges are 48px circles at left: 0
      const x = 24;
      const y1 = items[0].offsetTop + 24;
      const y2 = items[1].offsetTop + 24;
      const y3 = items[2].offsetTop + 24;

      const mid1Y = (y1 + y2) / 2;
      const mid2Y = (y2 + y3) / 2;
      const wave = 18; // gentle organic S-curve offset

      const d = `M ${x} ${y1} C ${x + wave} ${mid1Y - 15}, ${x - wave} ${mid1Y + 15}, ${x} ${y2} C ${x + wave} ${mid2Y - 15}, ${x - wave} ${mid2Y + 15}, ${x} ${y3}`;
      setPathD(d);
    };

    updatePath();
    window.addEventListener("resize", updatePath);
    return () => window.removeEventListener("resize", updatePath);
  }, []);

  useEffect(() => {
    const pathEl = pathRef.current;
    const container = containerRef.current;
    if (!pathEl || !container || !pathD) return;

    let len = 0;
    try {
      len = pathEl.getTotalLength();
    } catch {
      len = 400;
    }
    if (!len) return;

    const hasMatchMedia =
      typeof window !== "undefined" && typeof window.matchMedia === "function";
    const prefersReducedMotion =
      hasMatchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nodes = nodeRefs.current.filter(Boolean) as HTMLSpanElement[];
    const items = itemRefs.current.filter(Boolean) as HTMLLIElement[];

    if (prefersReducedMotion || !hasMatchMedia) {
      gsap.set(pathEl, { strokeDasharray: len, strokeDashoffset: 0 });
      items.forEach((el) => gsap.set(el, { opacity: 1, x: 0 }));
      nodes.forEach((el) => el.classList.add("is-active"));
      return;
    }

    gsap.set(pathEl, { strokeDasharray: len, strokeDashoffset: len });

    // Initial state: first step visible, subsequent steps subtle and waiting
    gsap.set(items[0], { opacity: 1, x: 0 });
    if (items[1]) gsap.set(items[1], { opacity: 0.28, x: 18 });
    if (items[2]) gsap.set(items[2], { opacity: 0.28, x: 18 });

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top 72%",
          end: "bottom 60%",
          scrub: 0.8,
        },
      });

      // Continuous, buttery-smooth vector line stroke draw from node 1 to node 3
      tl.to(
        pathEl,
        {
          strokeDashoffset: 0,
          duration: 3,
          ease: "none",
        },
        0
      );

      // Node 1 active at top of timeline
      tl.add(() => {
        nodes[0]?.classList.add("is-active");
      }, 0.05);

      // Node 2 arrives: badge pulses active and item 2 smoothly reveals
      if (items[1]) {
        tl.to(
          items[1],
          {
            opacity: 1,
            x: 0,
            duration: 0.5,
            ease: "power2.out",
          },
          1.2
        );
      }
      tl.add(() => {
        nodes[1]?.classList.add("is-active");
      }, 1.35);

      // Node 3 arrives: badge pulses active and item 3 smoothly reveals
      if (items[2]) {
        tl.to(
          items[2],
          {
            opacity: 1,
            x: 0,
            duration: 0.5,
            ease: "power2.out",
          },
          2.5
        );
      }
      tl.add(() => {
        nodes[2]?.classList.add("is-active");
      }, 2.7);
    }, container);

    return () => ctx.revert();
  }, [pathD]);

  return (
    <div className="container home-guidance">
      <section aria-labelledby="handover-heading">
        <h2 id="handover-heading">A clear handover, every time.</h2>

        <div className="handover-timeline-container" ref={containerRef}>
          {/* Animated SVG vector track */}
          {pathD && (
            <svg
              className="handover-timeline-svg"
              aria-hidden="true"
              role="presentation"
            >
              <path className="timeline-bg-track" d={pathD} fill="none" />
              <path
                ref={pathRef}
                className="timeline-animated-track"
                d={pathD}
                fill="none"
              />
            </svg>
          )}

          <ol className="handover-timeline-list">
            {guidance.map((item, index) => (
              <li
                key={item.title}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className="handover-timeline-item"
              >
                <span
                  ref={(el) => {
                    nodeRefs.current[index] = el;
                  }}
                  className="step-number"
                  aria-hidden="true"
                >
                  {item.step}
                </span>
                <div className="timeline-item-content">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Good questions, answered.</h2>
        {questions.map(([question, answer], index) => (
          <details key={question} open={index === 0}>
            <summary>
              {question}
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14" />
                <path className="disclosure-vertical" d="M12 5v14" />
              </svg>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
