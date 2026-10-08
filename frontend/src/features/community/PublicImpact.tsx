import { AnimatedStat } from "./AnimatedStat";
import { useEffect } from "react";
import { useQuery } from "../workflows/data";
type Impact = {
  data: {
    delivered_kg: string;
    estimated_meals: string;
    active_listings: number;
    includes_demo_data: boolean;
    month_start: string;
    server_time: string;
  };
};
export function PublicImpact() {
  const query = useQuery<Impact>("/public/impact");
  const { refresh } = query;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  const impact = query.data?.data;

  // Keep the marketing stage clean while live totals are loading or unavailable.
  // The query continues refreshing so the impact panel appears once data is ready.
  if (
    !impact ||
    !Number.isFinite(Number(impact.delivered_kg)) ||
    !Number.isFinite(Number(impact.estimated_meals)) ||
    !Number.isFinite(impact.active_listings)
  )
    return null;

  return (
    <section className="public-impact" aria-labelledby="public-impact-heading">
      <div className="container public-impact-panel">
        <h2 id="public-impact-heading">Shared this month</h2>
        {impact.includes_demo_data && (
          <span className="impact-preview-label">Preview totals</span>
        )}
        <dl className="public-impact-metrics">
          <div>
            <dt>Food delivered</dt>
            <dd>
              <AnimatedStat
                value={Number(impact.delivered_kg)}
                decimals={1}
                unit="kg"
              />
            </dd>
          </div>
          <div>
            <dt>Estimated meal equivalents</dt>
            <dd>
              <AnimatedStat
                value={Number(impact.estimated_meals)}
                decimals={1}
              />
            </dd>
          </div>
          <div>
            <dt>Live listings</dt>
            <dd>
              <AnimatedStat value={impact.active_listings} />
            </dd>
          </div>
        </dl>
        <p className="public-impact-label">
          {impact.includes_demo_data && "Illustrative activity. "}
          This month in UTC. Meal estimate: 0.4 kg per meal equivalent.
        </p>
      </div>
    </section>
  );
}
