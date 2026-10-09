import { useState, type FormEvent } from "react";
import { api, ApiError, type Page } from "../../lib/identity";
import { useAuth } from "./AuthContext";
import { useQuery, date } from "../workflows/data";
import { Feedback, QueryStatus } from "../workflows/Workspace";
import { invalidateOverview } from "../workflows/OverviewContext";
import { ThemedSelect } from "../../components/ThemedSelect";

type AccessRequest = {
  request_id: number;
  user_id: number;
  name: string;
  email: string;
  zone_id: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

export function RequestAdminAccess() {
  const auth = useAuth();
  const query = useQuery<Page<AccessRequest>>(
    "/account/admin-requests?limit=10",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const user = auth.session?.user;
  const latest = query.data?.data[0];
  const alreadyAdmin = user?.capabilities.includes("Admin");
  const eligible = Boolean(
    user?.verified_status && user.capabilities.length && !alreadyAdmin,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || !auth.session || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/account/admin-requests", {
        method: "POST",
        csrf: auth.session.csrf_token,
        body: { reason: reason.trim() },
      });
      setReason("");
      query.refresh();
      invalidateOverview();
      setNotice(
        "Request sent. Community administrators have been notified and can read your reason.",
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="settings-section"
      aria-labelledby="admin-access-heading"
    >
      <h2 id="admin-access-heading">Administrator access</h2>
      <p>
        Help review community members and manage your area. Explain why you want
        this responsibility; administrators can read your reason.
      </p>
      <QueryStatus {...query} />
      {alreadyAdmin ? (
        <p>You already have administrator access.</p>
      ) : !eligible ? (
        <p className="field-help">
          Your community role must be approved before you can request
          administrator access.
        </p>
      ) : latest?.status === "Pending" ? (
        <p className="notice" role="status">
          Your request is awaiting administrator review.
        </p>
      ) : (
        <form className="review-form" onSubmit={submit} aria-busy={busy}>
          <fieldset
            className="form-fields"
            disabled={busy || query.loading || !query.data}
          >
            <div className="field">
              <label htmlFor="admin-access-reason">
                Why do you want administrator access?
              </label>
              <textarea
                id="admin-access-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={10}
                maxLength={500}
                rows={3}
              />
              <small>
                10–500 characters. You can submit one request every 24 hours.
              </small>
            </div>
            <button
              className="button button-small"
              type="submit"
              disabled={reason.trim().length < 10}
            >
              {busy ? "Sending…" : "Request administrator access"}
            </button>
          </fieldset>
        </form>
      )}
      <Feedback error={error} notice={notice} />
      {latest && (
        <div className="review-panel">
          <h3>Latest request: {latest.status}</h3>
          <p className="field-help">Sent {date(latest.created_at)}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>Your reason: {latest.reason}</p>
          {latest.review_note && (
            <p style={{ whiteSpace: "pre-wrap" }}>
              Administrator’s decision: {latest.review_note}
            </p>
          )}
        </div>
      )}
      <button
        className="text-button"
        disabled={query.loading}
        onClick={() => {
          query.refresh();
          auth.refresh();
        }}
      >
        Refresh request status
      </button>
    </section>
  );
}

function AccessDecision({
  request,
  onComplete,
}: {
  request: AccessRequest;
  onComplete: () => void;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.session || busy) return;
    const form = new FormData(event.currentTarget);
    const approved =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "approve";
    setBusy(true);
    setError("");
    try {
      await api(`/admin/access-requests/${request.request_id}/review`, {
        method: "POST",
        csrf: auth.session.csrf_token,
        body: { approved, reason: String(form.get("reason")).trim() },
      });
      invalidateOverview();
      onComplete();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="review-form" onSubmit={submit} aria-busy={busy}>
      <fieldset className="form-fields" disabled={busy}>
        <div className="field">
          <label htmlFor={`request-decision-${request.request_id}`}>
            Decision reason
          </label>
          <textarea
            id={`request-decision-${request.request_id}`}
            name="reason"
            required
            minLength={3}
            maxLength={300}
            rows={2}
          />
          <small>This reason is visible to the applicant.</small>
        </div>
        <Feedback error={error} notice="" />
        <div className="actions">
          <button className="button button-small" type="submit" value="approve">
            {busy ? "Saving…" : "Approve admin access"}
          </button>
          <button
            className="button button-outline button-small"
            type="submit"
            value="reject"
          >
            Reject request
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function AdminAccessQueue({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState("Pending");
  const [cursors, setCursors] = useState<number[]>([0]);
  const cursor = cursors[cursors.length - 1];
  const query = useQuery<Page<AccessRequest>>(
    `/admin/access-requests?limit=10&cursor=${cursor}&status=${status}`,
  );
  const [notice, setNotice] = useState("");
  return (
    <section
      className="settings-section"
      aria-labelledby="access-requests-heading"
    >
      <h2 id="access-requests-heading">Administrator access requests</h2>
      <p>
        Read members’ reasons before granting access. Approved administrators
        can review members and grant access to others in their area.
      </p>
      <div className="field">
        <label htmlFor="access-request-filter">Request status</label>
        <ThemedSelect
          id="access-request-filter"
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setCursors([0]);
          }}
        >
          <option value="Pending">Awaiting review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </ThemedSelect>
      </div>
      <QueryStatus {...query} />
      <Feedback notice={notice} error="" />
      {query.data && (
        <>
          {!query.data.data.length && (
            <p>No {status.toLowerCase()} administrator requests.</p>
          )}
          <ul className="member-list">
            {query.data.data.map((request) => (
              <li className="member-row" key={request.request_id}>
                <div className="member-info">
                  <h3>{request.name}</h3>
                  <p>{request.email}</p>
                  <p className="field-help">
                    {date(request.created_at)} · {request.status}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    Reason: {request.reason}
                  </p>
                  {request.review_note && (
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      Decision: {request.review_note}
                    </p>
                  )}
                </div>
                {request.status === "Pending" && (
                  <AccessDecision
                    request={request}
                    onComplete={() => {
                      setNotice(
                        `Decision saved for ${request.name}. The applicant has been notified.`,
                      );
                      query.refresh();
                      onChange();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button
              className="text-button"
              disabled={query.loading || cursors.length === 1}
              onClick={() => setCursors((values) => values.slice(0, -1))}
            >
              Previous requests
            </button>
            <button
              className="text-button"
              disabled={query.loading || !query.data.meta.next_cursor}
              onClick={() => {
                const next = query.data?.meta.next_cursor;
                if (next) setCursors((values) => [...values, next]);
              }}
            >
              Next requests
            </button>
          </div>
        </>
      )}
      <button
        className="text-button"
        disabled={query.loading}
        onClick={query.refresh}
      >
        Refresh requests
      </button>
    </section>
  );
}
