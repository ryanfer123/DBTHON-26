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
    <section
      className="container public-impact"
      aria-label="This month’s prototype impact"
    >
      <h2>Shared this month</h2>
      <p>
        <strong>{Number(impact.delivered_kg).toFixed(1)} kg</strong> delivered
      </p>
      <p>
        <strong>{Number(impact.estimated_meals).toFixed(1)}</strong> estimated
        meal equivalents
      </p>
      <p>
        <strong>{impact.active_listings}</strong> live listings
      </p>
      <p className="public-impact-label">
        {impact.includes_demo_data
          ? "Prototype totals include synthetic demo data."
          : "Prototype totals; not independently verified pilot evidence."}{" "}
        This month in UTC. Meal estimate: 0.4 kg per meal equivalent.
      </p>
    </section>
  );
}
