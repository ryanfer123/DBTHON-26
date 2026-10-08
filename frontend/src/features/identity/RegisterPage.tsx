import { BrandMark } from "../../components/BrandMark";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { PageShell } from "../../components/PageShell";
import {
  api,
  loadZones,
  type PublicRole,
  type User,
  type Zone,
} from "../../lib/identity";
import { useAuth } from "./AuthContext";
import { ContactFields, LocationFields, PasswordField } from "./FormParts";

const publicRoles: PublicRole[] = ["Donor", "Receiver", "Volunteer"];
const descriptions = {
  Donor: "Share surplus food.",
  Receiver: "Receive food for your community.",
  Volunteer: "Help with collection and delivery.",
};

export function RegisterPage() {
  const [search] = useSearchParams();
  const initialRole =
    publicRoles.find((role) => role.toLowerCase() === search.get("role")) ??
    "Donor";
  const [roles, setRoles] = useState<PublicRole[]>([initialRole]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneError, setZoneError] = useState("");
  const [zonesLoading, setZonesLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const auth = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    loadZones(controller.signal)
      .then((zones) => {
        if (!controller.signal.aborted) {
          setZones(zones);
          setZoneError(
            zones.length ? "" : "No community areas are available yet.",
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setZoneError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setZonesLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  if (auth.session) return <Navigate to="/account" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roles.length) {
      setError("Choose at least one community role.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const email = String(form.get("email")).trim();
    try {
      await api<{ data: User }>("/auth/register", {
        method: "POST",
        body: {
          name: String(form.get("name")).trim(),
          email,
          password: String(form.get("password")),
          phone: form.get("phone"),
          zone_id: Number(form.get("zone_id")),
          roles,
          latitude: form.get("latitude"),
          longitude: form.get("longitude"),
          ...(roles.includes("Receiver")
            ? { capacity_kg: form.get("capacity_kg") }
            : {}),
        },
      });
      navigate("/sign-in", {
        replace: true,
        state: { registered: true, email },
      });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageShell>
      <main id="main" className="container account-page auth-layout">
        <section className="account-intro">
          <div className="auth-art" aria-hidden="true">
            <BrandMark />
          </div>
          <p className="auth-eyebrow">Good food. Better together.</p>
          <h1>
            Make room
            <br />
            for good.
          </h1>
          <p>Join your local community.</p>
          <p className="intro-detail">
            Choose how you’d like to help. Your zone administrator reviews your
            requested roles before approval.
          </p>
          <Link className="text-link" to="/sign-in">
            Already a member? Sign in
          </Link>
        </section>
        <section className="form-section" aria-labelledby="register-heading">
          <h2 id="register-heading">Create your account</h2>
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy} className="form-fields">
              <ContactFields />
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={100}
                  autoComplete="email"
                />
              </div>
              <PasswordField newPassword />
              <div className="field">
                <label htmlFor="zone">Community area</label>
                {zonesLoading ? (
                  <p role="status">Loading community areas…</p>
                ) : zoneError ? (
                  <div className="notice notice-error" role="alert">
                    <p>{zoneError}</p>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setZonesLoading(true);
                        setZoneError("");
                        setAttempt((a) => a + 1);
                      }}
                    >
                      Retry areas
                    </button>
                  </div>
                ) : (
                  <select id="zone" name="zone_id" required defaultValue="">
                    <option value="" disabled>
                      Choose your area
                    </option>
                    {zones.map((zone) => (
                      <option key={zone.zone_id} value={zone.zone_id}>
                        {zone.zone_name} · {zone.city}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <fieldset className="role-options">
                <legend>I’d like to help as a</legend>
                <p className="field-help">You can choose more than one role.</p>
                {publicRoles.map((role) => (
                  <label
                    key={role}
                    htmlFor={`role-${role}`}
                    className="role-option"
                    aria-label={role}
                  >
                    <input
                      id={`role-${role}`}
                      type="checkbox"
                      checked={roles.includes(role)}
                      onChange={(e) =>
                        setRoles((current) =>
                          e.target.checked
                            ? [...current, role]
                            : current.filter((item) => item !== role),
                        )
                      }
                    />
                    <span>
                      <strong>{role}</strong>
                      <small>{descriptions[role]}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              {roles.includes("Receiver") && (
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
                  />
                  <small>
                    Maximum food quantity you can safely receive at one time.
                  </small>
                </div>
              )}
              <LocationFields />
              <p className="field-help">
                Updates appear in your inbox. SMS and push alerts are not
                enabled yet.
              </p>
              {error && (
                <p className="notice notice-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button form-submit"
                disabled={zonesLoading || !!zoneError || !zones.length}
                type="submit"
              >
                {busy ? "Creating your account…" : "Create account"}
              </button>
            </fieldset>
          </form>
        </section>
      </main>
    </PageShell>
  );
}
