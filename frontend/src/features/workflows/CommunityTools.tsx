import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useAuth } from "../identity/AuthContext";
import {
  date,
  localInput,
  params,
  useCommand,
  useQuery,
  type Listing,
  type Meta,
  type Rows,
} from "./data";
import {
  Access,
  Feedback,
  Pagination,
  QueryStatus,
  Workspace,
} from "./Workspace";
import { useListLocation } from "./useListLocation";

type Need = {
  request_id: number;
  receiver_id: number;
  receiver_name: string;
  food_type: string;
  category: string;
  quantity_kg: string;
  delivered_kg: string;
  needed_by: string;
  note: string;
  status: string;
  close_reason: string | null;
  offer_count: number;
};
type Offer = {
  offer_id: number;
  listing_id: number;
  food_type: string;
  quantity_kg: string;
  status: string;
  donor_name: string;
};
type Update = {
  update_id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  ends_at: string;
  created_at: string;
};
type Suggestion = {
  suggestion_id: number;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  ends_at: string;
  status: string;
  reason: string | null;
};
const statuses = ["Open", "Fulfilled", "Closed", "Expired"];
const roleTools = ["Donor", "Receiver", "Volunteer", "Admin"];

export function RequestsPage() {
  const { session } = useAuth();
  const list = useListLocation();
  const status = list.value("status", "Open", statuses);
  const mine = list.value("mine", "false", ["false", "true"]);
  const q = list.value("q");
  const query = useQuery<Rows<Need>>(
    `/requests?${params({ status, mine, q, cursor: list.cursor ?? 0 })}`,
  );
  return (
    <Access roles={roleTools}>
      <Workspace
        title="Food requests"
        intro="Let your community know what is needed, or offer food you can share."
        action={
          session?.user.capabilities.includes("Receiver") ? (
            <Link className="button button-small" to="/requests/new">
              Post a food need
            </Link>
          ) : undefined
        }
      >
        <form
          className="workspace-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            list.setFilters({
              q: String(new FormData(e.currentTarget).get("q")).trim(),
            });
          }}
        >
          <div className="field">
            <label htmlFor="need-search">Search food requests</label>
            <input
              key={q}
              id="need-search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={80}
            />
          </div>
          <div className="field">
            <label htmlFor="need-status">Request status</label>
            <select
              id="need-status"
              value={status}
              onChange={(e) => list.setFilters({ status: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="need-owner">Show requests</label>
            <select
              id="need-owner"
              value={mine}
              onChange={(e) => list.setFilters({ mine: e.target.value })}
            >
              <option value="false">Community requests</option>
              <option value="true">My requests</option>
            </select>
          </div>
          <button className="button button-small" type="submit">
            Search requests
          </button>
        </form>
        <QueryStatus {...query} />
        {query.data && (
          <>
            <ul className="community-cards">
              {query.data.data.map((need) => (
                <li key={need.request_id}>
                  <span className="badge">
                    {need.status} · {need.category}
                  </span>
                  <h2>
                    <Link to={`/requests/${need.request_id}`}>
                      {need.food_type}
                    </Link>
                  </h2>
                  <p>
                    {need.quantity_kg} kg requested · {need.offer_count} offers
                  </p>
                  <p>Needed by {date(need.needed_by)}</p>
                  <p className="field-help">{need.receiver_name}</p>
                  <p className="community-copy">{need.note}</p>
                  <Link
                    className="text-link"
                    to={`/requests/${need.request_id}`}
                  >
                    View request and offers
                  </Link>
                </li>
              ))}
            </ul>
            {!query.data.data.length && (
              <p className="notice">
                No food requests match this view. Try another status or share
                what your kitchen needs.
              </p>
            )}
            <Pagination
              {...list}
              cursor={list.cursor}
              setCursor={list.setCursor}
              meta={query.data.meta}
            />
          </>
        )}
      </Workspace>
    </Access>
  );
}

export function NewRequestPage() {
  const command = useCommand(),
    navigate = useNavigate();
  const [defaultNeededBy] = useState(() =>
    localInput(new Date(Date.now() + 86400000)),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const response = await command.run("/requests", {
      food_type: String(f.get("food_type")).trim(),
      category: f.get("category"),
      quantity_kg: f.get("quantity_kg"),
      needed_by: new Date(String(f.get("needed_by"))).toISOString(),
      note: String(f.get("note")).trim(),
    });
    if (response) navigate(`/requests/${response.data.id}`);
  }
  return (
    <Access roles={["Receiver"]}>
      <Workspace
        title="Post a food need"
        intro="Describe a need for your kitchen or community. Donors can answer with whole food listings."
      >
        <Feedback {...command} />
        <form onSubmit={(e) => void submit(e)} className="community-form">
          <fieldset disabled={command.busy} className="form-fields">
            <div className="field">
              <label htmlFor="need-name">Food needed</label>
              <input id="need-name" name="food_type" maxLength={80} required />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="need-category">Category</label>
                <select id="need-category" name="category">
                  <option value="Veg">Vegetarian</option>
                  <option value="NonVeg">Non-vegetarian</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="need-quantity">Target quantity (kg)</label>
                <input
                  id="need-quantity"
                  name="quantity_kg"
                  type="number"
                  min="0.01"
                  max="999999.99"
                  step="0.01"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="needed-by">Needed by</label>
              <input
                id="needed-by"
                name="needed_by"
                type="datetime-local"
                defaultValue={defaultNeededBy}
                required
              />
              <p className="field-help">
                Your request expires at this time. Each offered listing must
                still fit your receiving capacity.
              </p>
            </div>
            <div className="field">
              <label htmlFor="need-note">Notes for donors</label>
              <textarea id="need-note" name="note" maxLength={300} rows={3} />
              <p className="field-help">
                Keep private contact or location details out of this community
                note.
              </p>
            </div>
            <div className="actions">
              <button className="button button-small" type="submit">
                Publish food request
              </button>
              <Link className="text-link" to="/requests">
                Back to requests
              </Link>
            </div>
          </fieldset>
        </form>
      </Workspace>
    </Access>
  );
}

export function RequestDetailPage() {
  const { id } = useParams(),
    { session } = useAuth();
  const query = useQuery<{ data: Need; offers: Offer[]; meta: Meta }>(
      `/requests/${id}`,
    ),
    command = useCommand();
  const need = query.data?.data;
  const canClose =
    need &&
    (need.receiver_id === session?.user.user_id ||
      session?.user.capabilities.includes("Admin"));
  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await command.run(`/requests/${id}/close`, {
        reason: String(new FormData(event.currentTarget).get("reason")).trim(),
      })
    ) {
      command.setNotice("Food request closed.");
      query.refresh();
    }
  }
  return (
    <Access roles={roleTools}>
      <Workspace
        title={need?.food_type ?? "Food request"}
        intro="Whole food listings offered by your community. Check availability and capacity before claiming."
      >
        <QueryStatus {...query} />
        <Feedback {...command} />
        {need && (
          <>
            <section className="community-summary">
              <span className="badge">
                {need.status} · {need.category}
              </span>
              <h2>{need.quantity_kg} kg requested</h2>
              <p>
                Needed by {date(need.needed_by)} · {need.receiver_name}
              </p>
              <p className="community-copy">{need.note}</p>
              <p>
                {need.delivered_kg} kg delivered to this receiver from linked
                offers.
              </p>
              {need.close_reason && <p>Closed: {need.close_reason}</p>}
            </section>
            <section className="dashboard-section">
              <h2>Food offered</h2>
              <ul className="community-cards">
                {query.data?.offers.map((offer) => (
                  <li key={offer.offer_id}>
                    <h3>{offer.food_type}</h3>
                    <p>
                      {offer.quantity_kg} kg · {offer.status} ·{" "}
                      {offer.donor_name}
                    </p>
                    <Link
                      className="text-link"
                      to={`/food/${offer.listing_id}`}
                    >
                      View offered listing
                    </Link>
                  </li>
                ))}
              </ul>
              {!query.data?.offers.length && (
                <p>No listings have been offered yet.</p>
              )}
            </section>
            {need.status === "Open" &&
              session?.user.capabilities.includes("Donor") &&
              need.receiver_id !== session.user.user_id && (
                <OfferListing requestId={Number(id)} refresh={query.refresh} />
              )}
            {canClose && need.status === "Open" && (
              <details className="community-form">
                <summary>Close this food request</summary>
                <form onSubmit={(e) => void close(e)}>
                  <div className="field">
                    <label htmlFor="close-request-reason">
                      Reason for closing
                    </label>
                    <input
                      id="close-request-reason"
                      name="reason"
                      minLength={3}
                      maxLength={300}
                      required
                    />
                  </div>
                  <button
                    className="button button-small button-outline"
                    disabled={command.busy}
                    type="submit"
                  >
                    Close request
                  </button>
                </form>
              </details>
            )}
          </>
        )}
      </Workspace>
    </Access>
  );
}

function OfferListing({
  requestId,
  refresh,
}: {
  requestId: number;
  refresh: () => void;
}) {
  const [q, setQ] = useState(""),
    [search] = useSearchParams();
  const query = useQuery<Rows<Listing>>(
      `/listings/mine?${params({ status: "Available", q, limit: 100 })}`,
    ),
    command = useCommand();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await command.run(`/requests/${requestId}/offers`, {
        listing_id: Number(new FormData(event.currentTarget).get("listing_id")),
      })
    ) {
      command.setNotice(
        "Listing offered. The receiver can review and claim it.",
      );
      refresh();
    }
  }
  return (
    <section className="dashboard-section community-form">
      <h2>Offer one of your listings</h2>
      <p>
        Offer a live listing. Claims remain subject to the usual capacity,
        distance, and verification checks.
      </p>
      <Feedback {...command} />
      <div className="field">
        <label htmlFor="offer-search">Search my available listings</label>
        <input
          id="offer-search"
          type="search"
          value={q}
          maxLength={80}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <QueryStatus {...query} />
      {query.data?.data.length ? (
        <form onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label htmlFor="offer-listing">Listing to offer</label>
            <select
              key={`${q}:${search.get("new_listing")}`}
              id="offer-listing"
              name="listing_id"
              defaultValue={search.get("new_listing") ?? undefined}
              required
            >
              {query.data.data.map((l) => (
                <option key={l.listing_id} value={l.listing_id}>
                  {l.food_type} · {l.quantity_kg} kg
                </option>
              ))}
            </select>
          </div>
          <button
            className="button button-small"
            disabled={command.busy}
            type="submit"
          >
            Offer listing
          </button>
        </form>
      ) : (
        <p>
          No available listings match. Publish food first, then return to link
          it.
        </p>
      )}
      <p>
        <Link
          className="text-link"
          to={`/donations/new?request_id=${requestId}`}
        >
          Create a listing for this request
        </Link>
      </p>
    </section>
  );
}

export function UpdatesPage() {
  const [suggestionRevision, setSuggestionRevision] = useState(0);
  const { session } = useAuth(),
    list = useListLocation();
  const kind = list.value("kind", "", ["", "Announcement", "PartnerResource"]);
  const query = useQuery<Rows<Update>>(
    `/community/updates?${params({ kind, cursor: list.cursor ?? 0 })}`,
  );
  return (
    <Workspace
      title="Community updates"
      intro="Announcements and local resources reviewed by your zone administrators."
    >
      <div className="workspace-toolbar">
        <div className="field">
          <label htmlFor="update-kind-filter">Show updates</label>
          <select
            id="update-kind-filter"
            value={kind}
            onChange={(e) => list.setFilters({ kind: e.target.value })}
          >
            <option value="">All updates</option>
            <option value="Announcement">Announcements</option>
            <option value="PartnerResource">Partner resources</option>
          </select>
        </div>
      </div>
      <QueryStatus {...query} />
      {query.data && (
        <>
          <UpdateCards updates={query.data.data} />
          {!query.data.data.length && (
            <p className="notice">
              No current updates in your area. Published announcements and
              resources will appear here.
            </p>
          )}
          <Pagination
            {...list}
            cursor={list.cursor}
            setCursor={list.setCursor}
            meta={query.data.meta}
          />
        </>
      )}
      {!!session?.user.capabilities.length && (
        <>
          <section className="dashboard-section">
            <h2>Suggest an update</h2>
            <p>
              Share an announcement or local resource for administrator review.
            </p>
            <UpdateForm
              path="/community/suggestions"
              button="Submit suggestion"
              done="Suggestion submitted for administrator review."
              refresh={() => setSuggestionRevision((value) => value + 1)}
            />
          </section>
          <MySuggestions key={suggestionRevision} />
        </>
      )}
    </Workspace>
  );
}
function MySuggestions() {
  const query = useQuery<Rows<Suggestion>>(
    "/community/suggestions/mine?limit=100",
  );
  return (
    <details className="dashboard-section">
      <summary>My submitted suggestions</summary>
      <QueryStatus {...query} />
      <ul className="community-cards">
        {query.data?.data.map((s) => (
          <li key={s.suggestion_id}>
            <h3>{s.title}</h3>
            <p>{s.status}</p>
            {s.reason && <p>{s.reason}</p>}
          </li>
        ))}
      </ul>
      {query.data?.data.length === 0 && (
        <p>You have not submitted any suggestions.</p>
      )}
    </details>
  );
}
function UpdateCards({
  updates,
  archive,
}: {
  updates: Update[];
  archive?: (id: number) => void;
}) {
  return (
    <ul className="community-cards">
      {updates.map((u) => (
        <li key={u.update_id}>
          <span className="badge">
            {u.kind === "Announcement" ? "Announcement" : "Partner resource"}
          </span>
          <h2>{u.title}</h2>
          <p className="community-copy">{u.body}</p>
          <p className="field-help">Available until {date(u.ends_at)}</p>
          {u.link && (
            <p>
              <a
                className="text-link"
                href={u.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open resource <span className="sr-only">(opens a new tab)</span>
              </a>
            </p>
          )}
          {archive && (
            <button
              className="text-button"
              onClick={() => archive(u.update_id)}
            >
              Archive update
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
function UpdateForm({
  path,
  button,
  done,
  refresh,
}: {
  path: string;
  button: string;
  done: string;
  refresh: () => void;
}) {
  const command = useCommand();
  const [defaultEndsAt] = useState(() =>
    localInput(new Date(Date.now() + 7 * 86400000)),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      f = new FormData(form);
    const link = String(f.get("link")).trim();
    if (
      await command.run(path, {
        kind: f.get("kind"),
        title: String(f.get("title")).trim(),
        body: String(f.get("body")).trim(),
        link: link || null,
        ends_at: new Date(String(f.get("ends_at"))).toISOString(),
      })
    ) {
      command.setNotice(done);
      form.reset();
      refresh();
    }
  }
  const prefix = path.includes("admin") ? "publish" : "suggest";
  return (
    <form className="community-form" onSubmit={(e) => void submit(e)}>
      <Feedback {...command} />
      <fieldset className="form-fields" disabled={command.busy}>
        <div className="field">
          <label htmlFor={`${prefix}-kind`}>Update type</label>
          <select id={`${prefix}-kind`} name="kind">
            <option value="Announcement">Announcement</option>
            <option value="PartnerResource">Partner resource</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-title`}>Title</label>
          <input id={`${prefix}-title`} name="title" maxLength={100} required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-body`}>Details</label>
          <textarea
            id={`${prefix}-body`}
            name="body"
            maxLength={1500}
            rows={4}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-link`}>
            HTTPS resource link (optional)
          </label>
          <input
            id={`${prefix}-link`}
            name="link"
            type="url"
            pattern="https://.*"
            maxLength={500}
          />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-end`}>Show until</label>
          <input
            id={`${prefix}-end`}
            name="ends_at"
            type="datetime-local"
            defaultValue={defaultEndsAt}
            required
          />
        </div>
        <button className="button button-small" type="submit">
          {button}
        </button>
      </fieldset>
    </form>
  );
}
export function AdminCommunityPage() {
  const list = useListLocation(),
    status = list.value("status", "Pending", [
      "Pending",
      "Published",
      "Rejected",
    ]);
  const query = useQuery<Rows<Suggestion>>(
      `/admin/community/suggestions?${params({ status, cursor: list.cursor ?? 0 })}`,
    ),
    updates = useQuery<Rows<Update>>("/community/updates?limit=100"),
    command = useCommand();
  async function act(path: string, body: unknown = {}) {
    if (await command.run(path, body)) {
      command.setNotice("Community update saved.");
      query.refresh();
      updates.refresh();
    }
  }
  return (
    <Workspace
      title="Community publishing"
      intro="Review suggestions and publish useful information for your zone."
    >
      <Feedback {...command} />
      <section>
        <h2>Member suggestions</h2>
        <div className="field community-form">
          <label htmlFor="suggestion-filter">Review status</label>
          <select
            id="suggestion-filter"
            value={status}
            onChange={(e) => list.setFilters({ status: e.target.value })}
          >
            <option>Pending</option>
            <option>Published</option>
            <option>Rejected</option>
          </select>
        </div>
        <QueryStatus {...query} />
        <ul className="community-cards">
          {query.data?.data.map((s) => (
            <li key={s.suggestion_id}>
              <span className="badge">{s.status}</span>
              <h3>{s.title}</h3>
              <p className="community-copy">{s.body}</p>
              <p>Show until {date(s.ends_at)}</p>
              {s.link && (
                <a
                  className="text-link"
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Review suggested resource{" "}
                  <span className="sr-only">(opens a new tab)</span>
                </a>
              )}
              {s.reason && <p>{s.reason}</p>}
              {s.status === "Pending" && (
                <>
                  <button
                    className="button button-small"
                    disabled={command.busy}
                    onClick={() =>
                      void act(
                        `/admin/community/suggestions/${s.suggestion_id}/publish`,
                      )
                    }
                  >
                    Publish suggestion
                  </button>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(
                        `/admin/community/suggestions/${s.suggestion_id}/reject`,
                        {
                          reason: String(
                            new FormData(e.currentTarget).get("reason"),
                          ).trim(),
                        },
                      );
                    }}
                  >
                    <div className="field">
                      <label htmlFor={`reject-${s.suggestion_id}`}>
                        Reason for declining
                      </label>
                      <input
                        id={`reject-${s.suggestion_id}`}
                        name="reason"
                        minLength={3}
                        maxLength={300}
                        required
                      />
                    </div>
                    <button
                      className="text-button"
                      disabled={command.busy}
                      type="submit"
                    >
                      Decline suggestion
                    </button>
                  </form>
                </>
              )}
            </li>
          ))}
        </ul>
        {query.data?.data.length === 0 && (
          <p>No suggestions in this review queue.</p>
        )}
        <Pagination
          {...list}
          cursor={list.cursor}
          setCursor={list.setCursor}
          meta={query.data?.meta}
        />
      </section>
      <section className="dashboard-section">
        <h2>Publish a zone update</h2>
        <UpdateForm
          path="/admin/community/updates"
          button="Publish update"
          done="Community update published."
          refresh={updates.refresh}
        />
      </section>
      <section className="dashboard-section">
        <h2>Published updates</h2>
        <QueryStatus {...updates} />
        <UpdateCards
          updates={updates.data?.data ?? []}
          archive={(id) => void act(`/admin/community/updates/${id}/archive`)}
        />
      </section>
    </Workspace>
  );
}
