import { useEffect, useState } from "react";
import { ImpactCharts } from "./ImpactCharts";
import { useParams } from "react-router";
import { Freshness } from "../../components/Freshness";
import { api, apiUrl } from "../../lib/identity";
import { useAuth } from "../identity/AuthContext";
import {
  date,
  params,
  useCommand,
  useQuery,
  type Impact,
  type Ledger,
  type Notification,
  type Rows,
  type Trust,
} from "./data";
import { useListLocation } from "./useListLocation";
import {
  Access,
  Feedback,
  Pagination,
  QueryStatus,
  Workspace,
} from "./Workspace";

function Message({
  message,
  refresh,
}: {
  message: Notification;
  refresh: () => void;
}) {
  const command = useCommand();
  return (
    <li className={`inbox-row ${message.read_at ? "" : "unread"}`}>
      <div>
        <h2>{message.message}</h2>
        <p className="field-help">
          {message.type} · {date(message.sent_at)} ·{" "}
          {message.read_at ? "Read" : "Unread"}
        </p>
        <Feedback {...command} />
      </div>
      {!message.read_at && (
        <button
          className="button button-outline button-small"
          disabled={command.busy}
          onClick={async () => {
            if (
              await command.run(
                `/notifications/${message.notification_id}/read`,
              )
            )
              refresh();
          }}
        >
          Mark read
        </button>
      )}
    </li>
  );
}
export function InboxPage() {
  const list = useListLocation();
  const unread = list.value("unread") === "true";
  const { cursor, setCursor } = list;
  const query = useQuery<Rows<Notification>>(
    `/notifications?${params({ unread_only: String(unread), cursor: cursor ?? 0 })}`,
  );
  const { refresh } = query;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <Workspace
      title="Your inbox"
      intro="Updates about your food-sharing community."
    >
      <div className="workspace-toolbar">
        <label className="review-check">
          <input
            type="checkbox"
            checked={unread}
            onChange={(event) => {
              list.setFilters({ unread: String(event.target.checked) });
            }}
          />
          Unread only
        </label>
        <button
          className="text-button"
          onClick={refresh}
          disabled={query.loading}
        >
          Refresh inbox
        </button>
      </div>
      <Freshness {...query} />
      <QueryStatus {...query} loading={query.loading && !query.data} />
      {query.data && (
        <>
          <ul className="inbox-list">
            {query.data.data.map((message) => (
              <Message
                key={message.notification_id}
                message={message}
                refresh={refresh}
              />
            ))}
          </ul>
          {!query.data.data.length && (
            <p className="list-message">
              {unread
                ? "You’re all caught up."
                : "No delivered updates yet. New updates appear here after processing."}
            </p>
          )}
          <Pagination
            previous={list.previous}
            meta={query.data.meta}
            cursor={cursor}
            setCursor={setCursor}
          />
        </>
      )}
      <p className="workspace-note">
        Updates appear here in your inbox. SMS and push alerts are not enabled
        yet. In-app updates refresh every 15 seconds while this tab is visible.
      </p>
    </Workspace>
  );
}
export function TrustPage() {
  const { userId } = useParams();
  const { session } = useAuth();
  const target = userId ?? String(session!.user.user_id);
  return (
    <Workspace
      title={userId ? "Member audit history" : "Your trust history"}
      intro="Ratings from completed exchanges and a record of your actions."
    >
      {userId ? (
        <Access roles={["Admin"]}>
          <TrustHistory target={target} admin />
        </Access>
      ) : (
        <TrustHistory target={target} />
      )}
    </Workspace>
  );
}
function TrustHistory({
  target,
  admin = false,
}: {
  target: string;
  admin?: boolean;
}) {
  const trust = useQuery<{ data: Trust }>(`/users/${target}/trust`);
  const [cursor, setCursor] = useState<string | number | null>(null);
  const ledger = useQuery<Rows<Ledger>>(
    `${admin ? `/admin/users/${target}/trust-ledger` : "/trust-ledger/mine"}?${params({ cursor: cursor ?? 0 })}`,
  );
  return (
    <>
      <QueryStatus {...trust} />
      {trust.data && (
        <div className="trust-summary">
          <h2>{trust.data.data.name}</h2>
          <p className="detail-emphasis">
            {trust.data.data.average_score === null
              ? "No ratings yet"
              : `${Number(trust.data.data.average_score).toFixed(1)} / 5`}
          </p>
          <p>
            {trust.data.data.rating_count} completed-exchange ratings received
          </p>
        </div>
      )}
      <div className="section-heading">
        <h2>Recorded actions</h2>
        <button
          className="text-button"
          onClick={() => {
            trust.refresh();
            ledger.refresh();
          }}
        >
          Refresh history
        </button>
      </div>
      <QueryStatus {...ledger} />
      {ledger.data && (
        <>
          <ol className="ledger-list">
            {ledger.data.data.map((entry) => (
              <li key={entry.sequence}>
                <div className="section-heading">
                  <h3>{entry.action_type.replaceAll(".", " · ")}</h3>
                  <span>#{entry.sequence}</span>
                </div>
                <p className="field-help">
                  {date(entry.occurred_at)} · {entry.ref_table} {entry.ref_id}
                </p>
                <details>
                  <summary>View audit record</summary>
                  <dl className="audit-hashes">
                    <dt>Previous hash</dt>
                    <dd>{entry.prev_hash}</dd>
                    <dt>Record hash</dt>
                    <dd>{entry.curr_hash}</dd>
                  </dl>
                  <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>
          {!ledger.data.data.length && (
            <p className="list-message">No recorded actions in this view.</p>
          )}
          <Pagination
            meta={ledger.data.meta}
            cursor={cursor}
            setCursor={setCursor}
          />
        </>
      )}
      {!admin && <VerifyMyChain />}
      <p className="workspace-note">
        Hash chains check stored history. A database owner can rewrite an entire
        chain; this is not distributed consensus or an external audit.
      </p>
    </>
  );
}
function utcBoundary(value: string) {
  return `${value}T00:00:00Z`;
}
export function ImpactPage() {
  const list = useListLocation();
  const [defaults] = useState(() => ({
    from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    to: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  }));
  const from = list.value("from", defaults.from),
    to = list.value("to", defaults.to);
  const grouping = list.value("grouping", "day", ["day", "zone", "city"]);
  const valid =
    from < to && Date.parse(to) - Date.parse(from) <= 366 * 86400000;
  return (
    <Access roles={["Admin"]}>
      <Workspace
        title="Community impact"
        intro="Food movement and participation within your zone."
      >
        <div className="workspace-toolbar">
          <div className="field">
            <label htmlFor="report-from">From (UTC)</label>
            <input
              id="report-from"
              type="date"
              value={from}
              required
              onChange={(event) =>
                list.setFilters({ from: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="report-to">To, excluded (UTC)</label>
            <input
              id="report-to"
              type="date"
              value={to}
              required
              onChange={(event) => list.setFilters({ to: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="report-group">Group by</label>
            <select
              id="report-group"
              value={grouping}
              onChange={(event) =>
                list.setFilters({ grouping: event.target.value })
              }
            >
              <option value="day">Day</option>
              <option value="zone">Zone</option>
              <option value="city">City</option>
            </select>
          </div>
        </div>
        {valid ? (
          <ImpactResults
            queryString={params({
              from: utcBoundary(from),
              to: utcBoundary(to),
              grouping,
            })}
          />
        ) : (
          <p className="notice notice-error" role="alert">
            Choose an ordered date range of up to 366 days.
          </p>
        )}
      </Workspace>
    </Access>
  );
}
function ImpactResults({ queryString }: { queryString: string }) {
  const query = useQuery<Impact>(`/admin/impact?${queryString}`);
  const { expire } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch(
        apiUrl(`/admin/impact/export?${queryString}`),
        { credentials: "include" },
      );
      if (response.status === 401) {
        expire();
        return;
      }
      if (!response.ok)
        throw new Error(
          "The report could not be exported. Refresh and try again.",
        );
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nomnom-impact.csv";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const rows = query.data?.data ?? [];
  const sum = (
    key:
      | "picked_up_kg"
      | "delivered_kg"
      | "estimated_meals"
      | "listings_created"
      | "confirmed_claims",
  ) => rows.reduce((total, row) => total + Number(row[key]), 0);
  return (
    <>
      <div className="actions report-actions">
        <button
          className="text-button"
          onClick={query.refresh}
          disabled={query.loading}
        >
          Refresh report
        </button>
        <button
          className="button button-outline button-small"
          disabled={query.loading || !query.data || exporting}
          onClick={() => void download()}
        >
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>
      <Feedback error={error} notice="" />
      <Freshness {...query} />
      <QueryStatus {...query} loading={query.loading && !query.data} />
      {query.data && (
        <>
          <dl className="impact-summary">
            <div>
              <dt>Food picked up</dt>
              <dd>
                {sum("picked_up_kg").toFixed(2)} <small>kg</small>
              </dd>
            </div>
            <div>
              <dt>Food delivered</dt>
              <dd>
                {sum("delivered_kg").toFixed(2)} <small>kg</small>
              </dd>
            </div>
            <div>
              <dt>Estimated meal equivalents</dt>
              <dd>{sum("estimated_meals").toFixed(1)}</dd>
            </div>
            <div>
              <dt>Claims confirmed</dt>
              <dd>{sum("confirmed_claims")}</dd>
            </div>
          </dl>
          <dl className="impact-summary">
            <div>
              <dt>Median time to claim</dt>
              <dd>
                {query.data.summary?.median_claim_latency_seconds == null
                  ? "No claims"
                  : `${Math.round(query.data.summary.median_claim_latency_seconds / 60)} min`}
              </dd>
            </div>
            <div>
              <dt>Expiry rate</dt>
              <dd>
                {query.data.summary?.expiry_rate_percent == null
                  ? "No listings"
                  : `${query.data.summary.expiry_rate_percent.toFixed(1)}%`}
              </dd>
            </div>
            <div>
              <dt>CO₂e</dt>
              <dd>Not configured</dd>
            </div>
          </dl>
          <p className="field-help">
            Expiry rate uses listings created within this date range, evaluated
            at report time. Median is computed across all claims in the range,
            never by averaging daily medians.
          </p>
          <ImpactCharts rows={rows} />
          <p className="field-help">
            {query.data.factors.meal_source}. Factor:{" "}
            {query.data.factors.meal_weight_kg} kg per meal equivalent.{" "}
            {query.data.factors.emissions_source}; CO₂e is unavailable.
          </p>
          <div
            className="report-table"
            role="region"
            aria-label="Impact details"
            tabIndex={0}
          >
            <table>
              <caption>
                Reporting timezone: {query.data.factors.timezone}. Date ranges
                include the start and exclude the end.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Period / area</th>
                  <th scope="col">Listings</th>
                  <th scope="col">Claims</th>
                  <th scope="col">Cancelled</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Picked up kg</th>
                  <th scope="col">Delivered kg</th>
                  <th scope="col">Donors</th>
                  <th scope="col">Receivers</th>
                  <th scope="col">Volunteers</th>
                  <th scope="col">Avg claim wait</th>
                  <th scope="col">Median wait</th>
                  <th scope="col">Expired kg</th>
                  <th scope="col">Cancelled listing kg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.period}:${index}`}>
                    <th scope="row">
                      {row.period}
                      <small>
                        {row.zone_name} · {row.city}
                      </small>
                    </th>
                    <td>{row.listings_created}</td>
                    <td>{row.confirmed_claims}</td>
                    <td>{row.cancelled_claims}</td>
                    <td>{row.completed_claims}</td>
                    <td>{row.picked_up_kg}</td>
                    <td>{row.delivered_kg}</td>
                    <td>{row.active_donors}</td>
                    <td>{row.active_receivers}</td>
                    <td>{row.active_volunteers}</td>
                    <td>
                      {row.claim_latency_seconds === null
                        ? "No claims"
                        : `${Math.round(row.claim_latency_seconds)} s (${row.claim_latency_count})`}
                    </td>
                    <td>
                      {row.median_claim_latency_seconds === null
                        ? "No claims"
                        : `${Math.round(row.median_claim_latency_seconds)} s`}
                    </td>
                    <td>{row.expired_kg}</td>
                    <td>{row.cancelled_listing_kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="workspace-note">
            Pickup and delivery totals are separate. Participation counts are
            distinct people within each row; summing daily counts would count
            returning people again.
          </p>
        </>
      )}
    </>
  );
}

function VerifyMyChain() {
  const [result, setResult] = useState<{
    valid: boolean;
    entries_verified: number;
    assurance: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="dashboard-section">
      <h2>Verify my chain</h2>
      <p>
        Recalculate every stored event hash, including pages not currently
        shown.
      </p>
      <button
        className="button button-outline button-small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setResult(null);
          try {
            setResult(
              (
                await api<{
                  data: {
                    valid: boolean;
                    entries_verified: number;
                    assurance: string;
                  };
                }>("/trust-ledger/mine/verification")
              ).data,
            );
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Verifying…" : "Verify my complete chain"}
      </button>
      {error && (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      )}
      {result && (
        <p role={result.valid ? "status" : "alert"} className="notice">
          {result.valid
            ? `${result.entries_verified} events verified. `
            : "Verification failed. "}
          {result.assurance}
        </p>
      )}
    </section>
  );
}
