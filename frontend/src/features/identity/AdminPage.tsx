import { ThemedSelect } from "../../components/ThemedSelect";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { useListLocation } from "../workflows/useListLocation";
import { useQuery } from "../workflows/data";
import { invalidateOverview } from "../workflows/OverviewContext";
import { Pagination } from "../workflows/Workspace";
import { AppLayout } from "../../components/AppLayout";
import {
  api,
  ApiError,
  type Page,
  type PublicRole,
  type User,
  type Zone,
  loadZones,
} from "../../lib/identity";
import { useAuth } from "./AuthContext";

function ReviewForm({
  user,
  onComplete,
}: {
  user: User;
  onComplete: () => void;
}) {
  const auth = useAuth();
  const requested = user.roles.filter((item) => item.role !== "Admin");
  const [roles, setRoles] = useState<PublicRole[]>(
    requested
      .filter((item) => item.approved)
      .map((item) => item.role as PublicRole),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    if (action !== "revoke" && !roles.length) {
      setError("Select at least one requested role to approve.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api<{ data: User }>(`/admin/users/${user.user_id}/verify`, {
        method: "POST",
        csrf: auth.session!.csrf_token,
        body: {
          verified: action !== "revoke",
          roles: action === "revoke" ? [] : roles,
          reason: String(form.get("reason")).trim(),
        },
      });
      invalidateOverview();
      onComplete();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) auth.expire();
      else setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="review-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="form-fields">
        <fieldset className="review-roles">
          <legend>Approved roles</legend>
          <p className="field-help">
            This selection replaces the member’s current public role approvals.
          </p>
          {requested.map((item) => (
            <label className="review-check" key={item.role}>
              <input
                type="checkbox"
                checked={roles.includes(item.role as PublicRole)}
                onChange={(event) =>
                  setRoles((current) =>
                    event.target.checked
                      ? [...current, item.role as PublicRole]
                      : current.filter((role) => role !== item.role),
                  )
                }
              />
              {item.role}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor={`reason-${user.user_id}`}>Review reason</label>
          <textarea
            id={`reason-${user.user_id}`}
            name="reason"
            required
            minLength={3}
            maxLength={300}
            rows={3}
          />
          <small>
            Record why the roles are approved or revoked. Required for every
            review.
          </small>
        </div>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="button button-small" type="submit" value="approve">
            {busy ? "Saving review…" : "Save approval"}
          </button>
          {user.verified_status && (
            <button
              className="button button-outline button-small"
              type="submit"
              value="revoke"
            >
              Revoke verification
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function AdminGrantForm({
  user,
  onComplete,
}: {
  user: User;
  onComplete: () => void;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason"),
    ).trim();
    setBusy(true);
    setError("");
    try {
      await api<{ data: User }>(`/admin/users/${user.user_id}/admin`, {
        method: "POST",
        csrf: auth.session!.csrf_token,
        body: { reason },
      });
      onComplete();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="review-form" onSubmit={submit}>
      <fieldset className="form-fields" disabled={busy}>
        <div className="field">
          <label htmlFor={`admin-reason-${user.user_id}`}>
            Why should {user.name} be an administrator?
          </label>
          <textarea
            id={`admin-reason-${user.user_id}`}
            name="reason"
            required
            minLength={3}
            maxLength={300}
            rows={2}
          />
        </div>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-small" type="submit">
          {busy ? "Granting access…" : "Grant administrator access"}
        </button>
      </fieldset>
    </form>
  );
}

export function AdminPage() {
  const auth = useAuth();
  const isBootstrapAdmin =
    auth.session?.user.email === "z1.admin@example.invalid";
  const location = useLocation();
  const list = useListLocation();
  const filter = list.value("filter", "pending", [
    "pending",
    "verified",
    "all",
  ]);
  const { cursor, setCursor } = list;
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    loadZones(controller.signal)
      .then(setZones)
      .catch(() => setZones([]));
    return () => controller.abort();
  }, []);
  const suffix = filter === "all" ? "" : `&verified=${filter === "verified"}`;
  const query = useQuery<Page<User>>(
    `/admin/users?limit=20&cursor=${cursor ?? 0}${suffix}`,
  );
  const state = {
    loading: query.loading,
    error: query.error,
    page: query.data,
  };
  const reload = () => {
    setReviewing(null);
    query.refresh();
  };
  return (
    <AppLayout>
      <main id="main" className="container account-page">
        <div className="page-heading">
          <div>
            <h1>Community members</h1>
            <p>
              {isBootstrapAdmin
                ? "Review requested roles across all community areas."
                : "Review requested roles in your community area."}
            </p>
          </div>
          <Link className="text-link" to="/account">
            Back to your account
          </Link>
        </div>
        <div className="admin-toolbar">
          <div className="field">
            <label htmlFor="member-filter">Show members</label>
            <ThemedSelect
              id="member-filter"
              value={filter}
              onValueChange={(event) => {
                list.setFilters({ filter: event });
                setReviewing(null);
                setNotice("");
              }}
            >
              <option value="pending">Awaiting verification</option>
              <option value="verified">Verified</option>
              <option value="all">All members</option>
            </ThemedSelect>
          </div>
          <button
            className="text-button"
            onClick={reload}
            disabled={state.loading}
          >
            Refresh members
          </button>
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {state.loading ? (
          <p role="status" className="list-message">
            Loading members…
          </p>
        ) : state.error ? (
          <div className="notice notice-error" role="alert">
            <p>{state.error}</p>
            <button className="button button-small" onClick={reload}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <ul className="member-list">
              {state.page?.data.map((user) => (
                <li key={user.user_id} className="member-row">
                  <div className="member-info">
                    <h2>{user.name}</h2>
                    <p>{user.email}</p>
                    <p>{user.phone}</p>
                    <p className="field-help">
                      Community area:{" "}
                      {zones.find((zone) => zone.zone_id === user.zone_id)
                        ?.zone_name ?? `Area ${user.zone_id}`}
                    </p>
                    <p className="field-help">
                      {user.roles
                        .map(
                          (item) =>
                            `${item.role}: ${item.approved ? "approved" : "pending"}`,
                        )
                        .join(" · ")}
                      {user.capacity_kg
                        ? ` · Capacity: ${user.capacity_kg} kg`
                        : ""}
                    </p>
                  </div>
                  <span className="member-status">
                    {user.verified_status ? "Verified" : "Awaiting review"}
                    <br />
                    <Link
                      className="text-link"
                      to={`/admin/users/${user.user_id}/audit`}
                      state={{ parent: location.pathname + location.search }}
                    >
                      Audit history
                    </Link>
                  </span>
                  {user.roles.some((item) => item.role !== "Admin") && (
                    <button
                      className="button button-outline button-small"
                      aria-expanded={reviewing === user.user_id}
                      aria-controls={`review-${user.user_id}`}
                      onClick={() =>
                        setReviewing((current) =>
                          current === user.user_id ? null : user.user_id,
                        )
                      }
                    >
                      {reviewing === user.user_id
                        ? "Close review"
                        : "Review member"}
                    </button>
                  )}
                  {reviewing === user.user_id && (
                    <div id={`review-${user.user_id}`} className="review-panel">
                      <h3>Review {user.name}</h3>
                      <ReviewForm
                        user={user}
                        onComplete={() => {
                          setNotice(`Review saved for ${user.name}.`);
                          reload();
                        }}
                      />
                    </div>
                  )}
                  {user.active &&
                    !user.roles.some(
                      (item) => item.role === "Admin" && item.approved,
                    ) && (
                      <details className="review-panel">
                        <summary>Grant administrator access</summary>
                        <p className="field-help">
                          This grants Admin access in your community area.
                          Public roles still require a separate review.
                        </p>
                        <AdminGrantForm
                          user={user}
                          onComplete={() => {
                            setNotice(
                              `Administrator access granted to ${user.name}.`,
                            );
                            reload();
                          }}
                        />
                      </details>
                    )}
                </li>
              ))}
            </ul>
            {!state.page?.data.length && (
              <p className="list-message">No members match this view.</p>
            )}
            <Pagination
              previous={list.previous}
              meta={
                state.page ? { ...state.page.meta, server_time: "" } : undefined
              }
              cursor={cursor}
              setCursor={setCursor}
            />
          </>
        )}
      </main>
    </AppLayout>
  );
}
