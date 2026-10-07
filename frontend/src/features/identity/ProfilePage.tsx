import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AppLayout } from "../../components/AppLayout";
import { api, ApiError, type User } from "../../lib/identity";
import { useAuth } from "./AuthContext";
import { ContactFields, LocationFields } from "./FormParts";
import { CommunityArea } from "./CommunityArea";

export function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const session = auth.session!;
  const user = session.user;
  const receiver = user.roles.some((item) => item.role === "Receiver");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api<{ data: User }>("/auth/me", {
        method: "PATCH",
        csrf: session.csrf_token,
        body: {
          name: String(form.get("name")).trim(),
          phone: form.get("phone"),
          latitude: form.get("latitude"),
          longitude: form.get("longitude"),
          ...(receiver ? { capacity_kg: form.get("capacity_kg") } : {}),
        },
      });
      auth.update(result.data);
      setMessage("Your profile has been saved.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        auth.expire();
        navigate("/sign-in", { replace: true, state: { from: "/account" } });
      } else setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppLayout>
      <main id="main" className="container account-page">
        <div className="page-heading">
          <div>
            <h1>Your account</h1>
            <p>Good to have you here, {user.name}.</p>
          </div>
          <button
            className="button button-outline button-small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await auth.logout();
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Please wait…" : "Sign out"}
          </button>
        </div>
        <div className="profile-layout">
          <aside className="account-summary" aria-label="Account status">
            <h2>Your community roles</h2>
            <p className="status-line">
              <span
                className={`status-dot ${user.verified_status ? "approved" : ""}`}
                aria-hidden="true"
              />
              {user.verified_status
                ? "Account verified"
                : "Awaiting verification"}
            </p>
            <ul className="role-status-list">
              {user.roles.map((item) => (
                <li key={item.role}>
                  <strong>{item.role}</strong>
                  <span>{item.approved ? "Approved" : "Pending review"}</span>
                </li>
              ))}
            </ul>
            {!user.verified_status && (
              <p className="field-help">
                Your zone administrator will review your requested roles. Your
                approval status appears here.
              </p>
            )}
            <dl className="account-details">
              <dt>Email address</dt>
              <dd>{user.email}</dd>
              <dt>Community area</dt>
              <dd>
                <CommunityArea zoneId={user.zone_id} />
              </dd>
            </dl>
            <button
              className="text-button"
              disabled={busy}
              onClick={auth.refresh}
            >
              Refresh verification status
            </button>
            {user.capabilities.includes("Admin") && (
              <Link className="button button-small admin-link" to="/admin">
                Review community members
              </Link>
            )}
          </aside>
          <section className="form-section" aria-labelledby="profile-heading">
            <h2 id="profile-heading">Your details</h2>
            <p className="field-help">
              Keep your contact and location details up to date.
            </p>
            <form onSubmit={submit} aria-busy={busy}>
              <fieldset disabled={busy} className="form-fields">
                <ContactFields name={user.name} phone={user.phone} />
                {receiver && (
                  <div className="field">
                    <label htmlFor="capacity">Receiving capacity (kg)</label>
                    <input
                      id="capacity"
                      name="capacity_kg"
                      type="number"
                      min="0.01"
                      max="999999.99"
                      step="0.01"
                      required
                      defaultValue={user.capacity_kg ?? ""}
                    />
                  </div>
                )}
                <LocationFields
                  latitude={user.latitude}
                  longitude={user.longitude}
                />
                {message && (
                  <p className="notice" role="status">
                    {message}
                  </p>
                )}
                {error && (
                  <p className="notice notice-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button form-submit" type="submit">
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </fieldset>
            </form>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
