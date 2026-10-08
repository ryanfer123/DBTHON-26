import { ThemedSelect } from "../../components/ThemedSelect";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { AppLayout } from "../../components/AppLayout";
import {
  api,
  ApiError,
  loadZones,
  type User,
  type Zone,
} from "../../lib/identity";
import { useAuth } from "./AuthContext";

export function ZoneConfirmationPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const session = auth.session!;
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState(String(session.user.zone_id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadZones(controller.signal)
      .then(setZones)
      .catch((cause) => {
        if (!controller.signal.aborted) setError((cause as Error).message);
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ data: User }>("/account/confirm-zone", {
        method: "POST",
        csrf: session.csrf_token,
        body: { zone_id: Number(zoneId) },
      });
      auth.update(result.data);
      navigate("/dashboard", { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <main id="main" className="container account-page">
        <h1>Confirm your community area</h1>
        <p>
          We updated the service areas. Choose the area where you currently
          participate to continue.
        </p>
        <form className="form-fields" onSubmit={submit}>
          <div className="field">
            <label htmlFor="community-zone">Community area</label>
            <ThemedSelect
              id="community-zone"
              value={zoneId}
              onValueChange={(event) => setZoneId(event)}
              required
            >
              {zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.zone_name} · {zone.city}
                </option>
              ))}
            </ThemedSelect>
          </div>
          <p className="field-help">
            Changing areas is paused while you have an active listing, claim, or
            pickup. Your past exchange records keep their original area.
          </p>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy || !zones.length}>
            {busy ? "Saving…" : "Confirm community area"}
          </button>
        </form>
      </main>
    </AppLayout>
  );
}
