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
  if (!impact) return null;

  return (
    <section className="public-impact" aria-labelledby="public-impact-heading">
      <div className="container public-impact-panel">
        <h2 id="public-impact-heading">Shared this month</h2>
        <dl className="public-impact-metrics">
          <div>
            <dt>Food delivered</dt>
            <dd>
              {Number(impact.delivered_kg).toFixed(1)} <span>kg</span>
            </dd>
          </div>
          <div>
            <dt>Estimated meal equivalents</dt>
            <dd>{Number(impact.estimated_meals).toFixed(1)}</dd>
          </div>
          <div>
            <dt>Live listings</dt>
            <dd>{impact.active_listings}</dd>
          </div>
        </dl>
        <p className="public-impact-label">
          {impact.includes_demo_data
            ? "Prototype totals include synthetic demo data."
            : "Prototype totals; not independently verified pilot evidence."}{" "}
          This month in UTC. Meal estimate: 0.4 kg per meal equivalent.
        </p>
      </div>
    </section>
  );
}
