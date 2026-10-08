import { ImpactScore } from "./ImpactScore";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useAuth } from "../identity/AuthContext";
import {
  date,
  useCommand,
  useQuery,
  type Exchange,
  type Listing,
  type Resource,
  type Rows,
} from "./data";
import { Feedback, Pagination, QueryStatus, Workspace } from "./Workspace";
import { FoodRow } from "./FoodRow";

export function SavedFoodPage() {
  const [cursor, setCursor] = useState<string | number | null>(null);
  const query = useQuery<Rows<Listing>>(
    `/saved-listings?cursor=${cursor ?? 0}`,
  );
  return (
    <Workspace
      title="Saved listings"
      intro="A private watchlist. Saving does not reserve food or notify the donor."
    >
      <QueryStatus {...query} />
      <p>
        Cancelled, completed, and expired food disappears from this view.
        Claimed food may still appear; allocation rules apply.
      </p>
      {query.data && (
        <>
          <ul className="food-list">
            {query.data.data.map((food) => (
              <FoodRow
                key={`${food.listing_id}:${food.is_saved}`}
                food={food}
                serverTime={query.data!.meta.server_time}
                parent="/saved"
                onSavedChange={query.refresh}
                own={false}
              />
            ))}
          </ul>
          {!query.data.data.length && (
            <p className="notice">
              No live saved listings. Save food from its details page.
            </p>
          )}
          <Pagination
            meta={query.data.meta}
            cursor={cursor}
            setCursor={setCursor}
          />
        </>
      )}
      <button className="text-button" onClick={query.refresh}>
        Refresh saved listings
      </button>
    </Workspace>
  );
}

type Issue = {
  issue_id: number;
  reporter_id: number;
  zone_id: number;
  listing_id: number;
  claim_id: number | null;
  message_id: number | null;
  category: string;
  detail: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  evidence: { body: string; created_at: string } | null;
};

export function ReportIssue({
  listingId,
  claimId,
  messageId,
}: {
  listingId: number;
  claimId?: number;
  messageId?: number;
}) {
  const [open, setOpen] = useState(false);
  const command = useCommand();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await command.run(`/listings/${listingId}/issues`, {
        category: String(form.get("category")),
        detail: String(form.get("detail")).trim(),
        ...(claimId ? { claim_id: claimId } : {}),
        ...(messageId ? { message_id: messageId } : {}),
      })
    ) {
      setOpen(false);
      command.setNotice("Report submitted. Follow its status in My reports.");
    }
  }
  return (
    <div className="experience-report">
      <button
        className="text-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open
          ? "Close report form"
          : messageId
            ? "Report this message"
            : "Report an issue"}
      </button>
      <Feedback {...command} />
      {open && (
        <form onSubmit={submit}>
          <fieldset className="form-fields" disabled={command.busy}>
            <label>
              Issue type
              <select
                name="category"
                defaultValue={messageId ? "AbusiveMessage" : "FoodSafety"}
              >
                <option value="FoodSafety">Food safety concern</option>
                <option value="NoShow">Missed collection</option>
                <option value="MisleadingListing">Misleading listing</option>
                {messageId && (
                  <option value="AbusiveMessage">Abusive message</option>
                )}
                <option value="Other">Other</option>
              </select>
            </label>
            <label>
              What happened?
              <textarea
                name="detail"
                minLength={3}
                maxLength={1000}
                rows={3}
                required
              />
            </label>
            <p className="field-help">
              The administrator can see this report
              {messageId ? " and the selected message" : ""}. Include relevant
              facts; avoid personal contact details. A report does not certify
              safety or cancel an exchange.
            </p>
            <button className="button button-small" type="submit">
              {command.busy ? "Submitting…" : "Submit report"}
            </button>
          </fieldset>
        </form>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  admin,
  refresh,
}: {
  issue: Issue;
  admin: boolean;
  refresh: () => void;
}) {
  const { session } = useAuth();
  const command = useCommand();
  return (
    <article className="experience-card">
      <h2>
        Report #{issue.issue_id} · {issue.category}
      </h2>
      <p>
        {issue.status} · {date(issue.created_at)} · area #{issue.zone_id}
      </p>
      <Link to={`/food/${issue.listing_id}`}>Listing #{issue.listing_id}</Link>
      {issue.claim_id && (
        <>
          {" "}
          ·{" "}
          <Link to={`/claims/${issue.claim_id}`}>
            Exchange #{issue.claim_id}
          </Link>
        </>
      )}
      <p className="message-body">{issue.detail}</p>
      {issue.evidence && (
        <blockquote>
          <p className="message-body">{issue.evidence.body}</p>
          <footer>Reported message · {date(issue.evidence.created_at)}</footer>
        </blockquote>
      )}
      {issue.review_note && (
        <p className="notice">
          Review: {issue.review_note} · {date(issue.reviewed_at)}
        </p>
      )}
      <Feedback {...command} />
      {admin &&
        issue.reporter_id !== session?.user.user_id &&
        ["Open", "Reviewing"].includes(issue.status) && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (
                await command.run(`/admin/issues/${issue.issue_id}/review`, {
                  status: String(form.get("status")),
                  note: String(form.get("note")).trim(),
                })
              )
                refresh();
            }}
          >
            <fieldset className="form-fields" disabled={command.busy}>
              <label>
                Review outcome
                <select name="status" defaultValue="Reviewing">
                  <option value="Reviewing">Reviewing</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Dismissed">Dismissed</option>
                </select>
              </label>
              <label>
                Note for the reporter
                <textarea
                  name="note"
                  minLength={3}
                  maxLength={500}
                  required
                  rows={2}
                />
              </label>
              <button className="button button-small" type="submit">
                Save review
              </button>
            </fieldset>
          </form>
        )}
    </article>
  );
}

export function IssuesPage({ admin = false }: { admin?: boolean }) {
  const [cursor, setCursor] = useState<string | number | null>(null);
  const [status, setStatus] = useState(admin ? "Open" : "");
  const query = useQuery<Rows<Issue>>(
    `${admin ? "/admin/issues" : "/issues/mine"}?cursor=${cursor ?? 0}${admin && status ? `&status=${status}` : ""}`,
  );
  return (
    <Workspace
      title={admin ? "Issue review" : "My reports"}
      intro={
        admin
          ? "Review evidence from members in the areas you administer."
          : "Follow the concerns you submitted and their review outcomes."
      }
    >
      {admin && (
        <label className="control-filter">
          Status{" "}
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCursor(null);
            }}
          >
            <option value="">All</option>
            {["Open", "Reviewing", "Resolved", "Dismissed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <QueryStatus {...query} />
      {query.data && (
        <>
          {query.data.data.map((issue) => (
            <IssueCard
              key={issue.issue_id}
              issue={issue}
              admin={admin}
              refresh={query.refresh}
            />
          ))}
          {!query.data.data.length && (
            <p className="notice">No reports in this view.</p>
          )}
          <Pagination
            meta={query.data.meta}
            cursor={cursor}
            setCursor={setCursor}
          />
        </>
      )}
      <button className="text-button" onClick={query.refresh}>
        Refresh reports
      </button>
    </Workspace>
  );
}

type Message = {
  message_id: number;
  sender_id: number;
  body: string;
  created_at: string;
};
type Conversation = Rows<Message> & { can_send: boolean };
export function ExchangeChat({ exchange }: { exchange: Exchange }) {
  const { session } = useAuth();
  const [cursor, setCursor] = useState<string | number | null>(null);
  const query = useQuery<Conversation>(
    `/claims/${exchange.claim_id}/messages?cursor=${cursor ?? 0}`,
    { poll: true },
  );
  const command = useCommand();
  const names = new Map([
    [exchange.donor_id, exchange.donor_name],
    [exchange.receiver_id, exchange.receiver_name],
    [exchange.volunteer_id, exchange.volunteer_name ?? "Volunteer"],
  ]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = String(new FormData(formElement).get("body")).trim();
    if (await command.run(`/claims/${exchange.claim_id}/messages`, { body })) {
      formElement.reset();
      query.refresh();
      command.setNotice("Message sent.");
    }
  }
  return (
    <section className="experience-card">
      <h2>Exchange messages</h2>
      <p>
        Only participants can read this conversation. Keep pickup coordination
        here; do not send payment or sensitive details.
      </p>
      <QueryStatus {...query} />
      {query.data && (
        <>
          <ol className="message-list">
            {query.data.data.map((message) => (
              <li key={message.message_id}>
                <strong>
                  {message.sender_id === session?.user.user_id
                    ? "You"
                    : (names.get(message.sender_id) ?? "Exchange participant")}
                </strong>{" "}
                ·{" "}
                <time dateTime={message.created_at}>
                  {date(message.created_at)}
                </time>
                <p className="message-body">{message.body}</p>
                {message.sender_id !== session?.user.user_id && (
                  <ReportIssue
                    listingId={exchange.listing_id}
                    claimId={exchange.claim_id}
                    messageId={message.message_id}
                  />
                )}
              </li>
            ))}
          </ol>
          {!query.data.data.length && <p>No messages on this page.</p>}
          <Pagination
            meta={query.data.meta}
            cursor={cursor}
            setCursor={setCursor}
          />
          {query.data.can_send ? (
            <form onSubmit={send}>
              <fieldset className="form-fields" disabled={command.busy}>
                <label>
                  Your message
                  <textarea
                    name="body"
                    maxLength={1000}
                    minLength={1}
                    required
                    rows={3}
                  />
                </label>
                <button className="button button-small" type="submit">
                  Send message
                </button>
              </fieldset>
            </form>
          ) : (
            <p className="notice">This exchange is read-only.</p>
          )}
        </>
      )}
      <Feedback {...command} />
    </section>
  );
}

export function PickupCalendar({
  exchange,
  serverTime,
}: {
  exchange: Exchange;
  serverTime: string;
}) {
  const agreed =
    exchange.pickup_id &&
    exchange.volunteer_id &&
    exchange.scheduled_time &&
    exchange.status === "Confirmed" &&
    exchange.pickup_status === "Scheduled" &&
    Date.parse(exchange.expiry_window_end) > Date.parse(serverTime) &&
    Date.parse(exchange.scheduled_time) <
      Date.parse(exchange.expiry_window_end) &&
    [exchange.donor_id, exchange.receiver_id, exchange.volunteer_id].every(
      (id) => exchange.schedule_confirmed_by?.includes(id),
    );
  if (!agreed) return null;
  const stamp = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  function download() {
    const start = exchange.scheduled_time!;
    const end = new Date(
      Math.min(
        Date.parse(start) + 15 * 60000,
        Date.parse(exchange.expiry_window_end),
      ),
    ).toISOString();
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Second Table//Pickup//EN",
      "BEGIN:VEVENT",
      `UID:claim-${exchange.claim_id}-pickup-${exchange.pickup_id}@secondtable`,
      `SEQUENCE:${exchange.schedule_version ?? 1}`,
      `DTSTAMP:${stamp(serverTime)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      "SUMMARY:Second Table food collection",
      "DESCRIPTION:Check the exchange in Second Table for current arrangements before travel.",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/calendar;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `second-table-pickup-${exchange.claim_id}.ics`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div>
      <button className="button button-outline button-small" onClick={download}>
        Add agreed pickup to calendar
      </button>
      <p className="field-help">
        Calendar copies do not update automatically. Refresh this exchange and
        download again after a schedule change.
      </p>
    </div>
  );
}

type Impact = {
  picked_up_kg: string;
  delivered_kg: string;
  delivered_exchanges: number;
  donated_kg: string;
  received_kg: string;
  transported_kg: string;
  estimated_meals: number;
  includes_demo_data: boolean;
  period_start: string;
  period_end: string;
};
export function PersonalImpactPage() {
  const [days, setDays] = useState("30");
  const query = useQuery<Resource<Impact>>(`/impact/mine?days=${days}`);
  const impact = query.data?.data;
  const kg = (value: string) =>
    `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
  return (
    <Workspace
      title="My impact"
      intro="Your recorded participation in this community area."
    >
      <div className="personal-impact">
        <div className="field impact-period">
          <label htmlFor="impact-period">Period</label>
          <select
            id="impact-period"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
        <QueryStatus {...query} />
        {impact && !query.loading && !query.error && (
          <>
            <ImpactScore
              deliveredKg={impact.delivered_kg}
              days={days}
              includesDemoData={impact.includes_demo_data}
            />
            {impact.includes_demo_data && (
              <p className="notice">
                This database includes demo fixtures. These totals are not pilot
                evidence.
              </p>
            )}
            <dl className="detail-list personal-impact-totals">
              <dt>Collected</dt>
              <dd>{kg(impact.picked_up_kg)}</dd>
              <dt>Successfully delivered</dt>
              <dd>{kg(impact.delivered_kg)}</dd>
              <dt>Delivered exchanges</dt>
              <dd>{impact.delivered_exchanges}</dd>
              <dt>Donated and delivered</dt>
              <dd>{kg(impact.donated_kg)}</dd>
              <dt>Received and delivered</dt>
              <dd>{kg(impact.received_kg)}</dd>
              <dt>Transported and delivered</dt>
              <dd>{kg(impact.transported_kg)}</dd>
              <dt>Estimated meals</dt>
              <dd>{impact.estimated_meals.toLocaleString()}</dd>
            </dl>
            <p>
              Meals are estimated at 0.4 kg per meal. Role totals may overlap;
              the overall delivered total counts each listing once. Collection
              alone does not count as delivery.
            </p>
            <p className="field-help">
              {date(impact.period_start)} – {date(impact.period_end)}
            </p>
          </>
        )}
        <button className="text-button" onClick={query.refresh}>
          Refresh my impact
        </button>
      </div>
    </Workspace>
  );
}
