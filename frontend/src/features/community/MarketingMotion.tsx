import { useEffect } from "react";

/** Motion is isolated to the public landing page and always has a static layout. */
export function MarketingMotion() {
  useEffect(() => {
    // Test DOMs and older browsers can still use the complete static story.
    if (typeof window.matchMedia !== "function") return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const setup = async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] =
        await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const desktop = window.matchMedia("(min-width: 900px)");
      let lenis: InstanceType<typeof Lenis> | null = null;
      let trigger: ReturnType<typeof ScrollTrigger.create> | null = null;
      let tween: gsap.core.Tween | null = null;
      let ticker: ((time: number) => void) | null = null;

      const section = document.querySelector<HTMLElement>(".marketing-story");
      const track = section?.querySelector<HTMLElement>(".story-track");

      let revealContext: ReturnType<typeof gsap.context> | null = null;

      const reset = () => {
        revealContext?.revert();
        revealContext = null;
        section?.classList.remove("story-scrolling");
        trigger?.kill();
        trigger = null;
        tween?.kill();
        tween = null;
        if (lenis && ticker) gsap.ticker.remove(ticker);
        ticker = null;
        lenis?.destroy();
        lenis = null;
        delete window.nomNomScrollTo;
        if (track) gsap.set(track, { clearProps: "transform" });
      };

      const configure = () => {
        reset();
        if (cancelled || reduced.matches) return;

        // Initialize Lenis normalized momentum scrolling across the page
        lenis = new Lenis({ autoRaf: false, smoothWheel: true, lerp: 0.08 });
        ticker = (time: number) => lenis?.raf(time * 1000);
        gsap.ticker.add(ticker);
        gsap.ticker.lagSmoothing(0);
        lenis.on("scroll", ScrollTrigger.update);
        window.nomNomScrollTo = (element) =>
          lenis?.scrollTo(element, { duration: 0.8 });

        // If horizontal track exists on desktop, configure pin
        if (track && section && desktop.matches) {
          section.classList.add("story-scrolling");
          const distance = () =>
            Math.max(0, track.scrollWidth - window.innerWidth);
          tween = gsap.to(track, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: () => `+=${distance()}`,
              scrub: 0.75,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          trigger = tween.scrollTrigger as typeof trigger;
        }

        revealContext = gsap.context(() => {
          for (const selector of [
            ".public-impact-panel",
            ".close-intro",
            ".close-paths",
          ]) {
            const element = document.querySelector(selector);
            if (!element) continue;
            gsap.from(element, {
              y: 32,
              opacity: 0,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: { trigger: element, start: "top 92%", once: true },
            });
          }
          if (document.querySelector(".public-impact"))
            gsap.from(".public-impact-metrics > div", {
              y: 20,
              opacity: 0,
              duration: 0.6,
              stagger: 0.12,
              scrollTrigger: {
                trigger: ".public-impact",
                start: "top 85%",
                once: true,
              },
            });
          gsap.from(".close-paths > a", {
            y: 24,
            duration: 0.65,
            stagger: 0.12,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ".close-paths",
              start: "top 90%",
              once: true,
            },
          });
        });
        ScrollTrigger.refresh();
      };

      const change = () => configure();
      reduced.addEventListener("change", change);
      desktop.addEventListener("change", change);
      configure();
      dispose = () => {
        reduced.removeEventListener("change", change);
        desktop.removeEventListener("change", change);
        reset();
      };
    };
    void setup().catch(() => {
      // Animation support is optional; the unanimated content remains complete.
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return null;
}
