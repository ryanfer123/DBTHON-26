import { Freshness } from "../../components/Freshness";
import { Link } from "react-router";
import { useOverview } from "./OverviewContext";
import { date } from "./data";
import { Countdown, QueryStatus, Workspace } from "./Workspace";
const metricNames: Record<string, string> = {
  live_donations: "Live donations",
  active_exchanges: "Active exchanges",
  active_deliveries: "Active deliveries",
  pending_reviews: "Pending reviews",
};
export function DashboardPage() {
  const query = useOverview();
  const data = query.data?.data;
  const roles = data?.capabilities ?? [];
  return (
    <Workspace title="Your dashboard" intro="Your next steps, in one place.">
      <Freshness {...query} updatedAt={query.updatedAt ?? null} />
      <QueryStatus {...query} loading={query.loading && !data} />
      {data && (
        <>
          {!roles.length && (
            <div className="notice">
              <h2>Your community starts here.</h2>
              <p>
                Your requested roles are awaiting review. Keep your details
                current and check your verification status.
              </p>
              <Link className="text-link" to="/account">
                Check verification status
              </Link>
            </div>
          )}
          <dl className="dashboard-summary">
            {Object.entries(data.summaries).map(([key, value]) => (
              <div key={key}>
                <dd>{value}</dd>
                <dt>{metricNames[key]}</dt>
              </div>
            ))}
            <div>
              <dd>{data.unread_count}</dd>
              <dt>Unread updates</dt>
            </div>
          </dl>
          {!!roles.length && (
            <section className="dashboard-section">
              <h2>Start something good</h2>
              <div className="dashboard-shortcuts">
                {roles.includes("Donor") && (
                  <Link
                    className="button button-outline button-small"
                    to="/donations/new"
                  >
                    Share some food
                  </Link>
                )}
                {roles.includes("Receiver") && (
                  <Link
                    className="button button-outline button-small"
                    to="/food"
                  >
                    Find food
                  </Link>
                )}
                {roles.includes("Volunteer") && (
                  <Link
                    className="button button-outline button-small"
                    to="/deliveries"
                  >
                    Arrange a delivery
                  </Link>
                )}
                {roles.includes("Admin") && (
                  <Link
                    className="button button-outline button-small"
                    to="/admin?filter=pending"
                  >
                    Review community members
                  </Link>
                )}
              </div>
            </section>
          )}
          {roles.some((role) =>
            ["Donor", "Receiver", "Volunteer"].includes(role),
          ) && (
            <section className="dashboard-section">
              <div className="section-heading">
                <h2>Coming up</h2>
                <div className="actions">
                  {roles.some((role) =>
                    ["Donor", "Receiver"].includes(role),
                  ) && (
                    <Link className="text-link" to="/claims?status=Confirmed">
                      View all exchanges
                    </Link>
                  )}
                  {roles.includes("Volunteer") && (
                    <Link className="text-link" to="/deliveries?view=mine">
                      View all deliveries
                    </Link>
                  )}
                </div>
              </div>
              <ul className="dashboard-list">
                {data.upcoming.map((item) => (
                  <li key={`${item.kind}:${item.claim_id}:${item.pickup_id}`}>
                    <h3>{item.food_type}</h3>
                    <p>
                      {item.kind === "delivery" ? "Delivery" : "Exchange"} #
                      {item.claim_id} · {item.status}
                    </p>
                    <p>Collect by {date(item.expiry_window_end)}</p>
                    <Countdown
                      key={query.data!.meta.server_time}
                      end={item.expiry_window_end}
                      serverTime={query.data!.meta.server_time}
                    />
                    <Link
                      className="button button-outline button-small"
                      to={`/claims/${item.claim_id}`}
                      state={{
                        parent:
                          item.kind === "delivery"
                            ? "/deliveries?view=mine"
                            : "/claims?status=Confirmed",
                      }}
                    >
                      Open {item.kind}
                    </Link>
                  </li>
                ))}
              </ul>
              {!data.upcoming.length && (
                <p className="list-message">
                  No active exchanges or deliveries. Use the shortcuts above to
                  get started.
                </p>
              )}
            </section>
          )}
          <section className="dashboard-section">
            <div className="section-heading">
              <h2>Community updates</h2>
              <Link className="text-link" to="/inbox">
                View inbox
              </Link>
            </div>
            <ul className="dashboard-list updates-list">
              {data.updates.map((message) => (
                <li key={message.notification_id}>
                  <p>{message.message}</p>
                  <Link className="text-link" to="/inbox?unread=true">
                    Read update
                  </Link>
                </li>
              ))}
            </ul>
            {!data.updates.length && (
              <p className="list-message">
                You’re all caught up. New delivered updates appear in your
                inbox.
              </p>
            )}
          </section>
        </>
      )}
    </Workspace>
  );
}
