import type { ImpactRow } from "./data";
export function ImpactCharts({ rows }: { rows: ImpactRow[] }) {
  const max = Math.max(
    1,
    ...rows.map(
      (row) =>
        Number(row.delivered_kg) +
        Number(row.expired_kg) +
        Number(row.cancelled_listing_kg),
    ),
  );
  const hasData = rows.some(
    (row) =>
      Number(row.delivered_kg) +
        Number(row.expired_kg) +
        Number(row.cancelled_listing_kg) >
      0,
  );
  return (
    <section className="impact-charts">
      <h2>Food outcomes by reporting period</h2>
      <p className="field-help">
        Delivered, expired and cancelled quantities are separate outcomes.
        Pickup totals remain separate in the table. Only your authorised zone is
        compared; other communities’ data stays private.
      </p>
      {hasData ? (
        <>
          <div className="chart-legend">
            <span>● Delivered</span>
            <span>◷ Expired</span>
            <span>× Cancelled</span>
          </div>
          <div
            className="chart-scroll"
            role="region"
            aria-label="Scrollable food outcome chart"
            tabIndex={0}
          >
            <svg
              viewBox={`0 0 700 ${Math.max(100, rows.length * 44 + 40)}`}
              role="img"
              aria-label="Delivered, expired and cancelled kilograms. Exact values appear in the table below."
            >
              <title>Food outcomes in kilograms for your authorised zone</title>
              {rows.map((row, index) => {
                const delivered = (Number(row.delivered_kg) / max) * 470,
                  expired = (Number(row.expired_kg) / max) * 470,
                  cancelled = (Number(row.cancelled_listing_kg) / max) * 470;
                return (
                  <g
                    key={`${row.period}:${index}`}
                    transform={`translate(0,${index * 44 + 20})`}
                  >
                    <text x="0" y="19" fill="currentColor" fontSize="12">
                      {row.period === "Total" ? row.zone_name : row.period}
                    </text>
                    <rect
                      x="140"
                      y="0"
                      width={delivered}
                      height="28"
                      fill="#36755c"
                    />
                    <rect
                      x={140 + delivered}
                      y="0"
                      width={expired}
                      height="28"
                      fill="#ba692b"
                    />
                    <rect
                      x={140 + delivered + expired}
                      y="0"
                      width={cancelled}
                      height="28"
                      fill="#687771"
                    />
                    <text
                      x={Math.min(630, 150 + delivered + expired + cancelled)}
                      y="19"
                      fill="currentColor"
                      fontSize="12"
                    >
                      {(
                        Number(row.delivered_kg) +
                        Number(row.expired_kg) +
                        Number(row.cancelled_listing_kg)
                      ).toFixed(1)}{" "}
                      kg
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      ) : (
        <p className="empty-state">
          No delivered, expired or cancelled food in this range. Choose a wider
          date range; the table still shows listing and claim activity.
        </p>
      )}
    </section>
  );
}
