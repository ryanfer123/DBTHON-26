import { useEffect, useRef, useState } from "react";

/** Animate once on entry; expose the final value to assistive technology. */
export function AnimatedStat({
  value,
  decimals = 0,
  unit = "",
}: {
  value: number;
  decimals?: number;
  unit?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [animation, setAnimation] = useState({ target: value, value });
  const display = animation.target === value ? animation.value : value;
  useEffect(() => {
    if (
      !ref.current ||
      !Number.isFinite(value) ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const started = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - started) / 1000);
          setAnimation({
            target: value,
            value: value * (1 - (1 - progress) ** 3),
          });
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span ref={ref}>
      <span className="sr-only">
        {value.toFixed(decimals)}
        {unit && ` ${unit}`}
      </span>
      <span aria-hidden="true">
        {display.toFixed(decimals)}
        {unit && (
          <>
            {" "}
            <span className="stat-unit">{unit}</span>
          </>
        )}
      </span>
    </span>
  );
}
