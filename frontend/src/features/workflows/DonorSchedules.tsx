import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api, ApiError } from "../../lib/identity";
import { useAuth } from "../identity/AuthContext";
import { date, useQuery, type Listing, type Rows } from "./data";
import { Access, Feedback, QueryStatus, Workspace } from "./Workspace";

type Schedule = {
  schedule_id: number;
  template_listing_id: number;
  food_type: string;
  local_time: string;
  time_zone: string;
  enabled: boolean;
  next_due_at: string;
};
export function DonorSchedulesPage() {
  const auth = useAuth();
  const [search] = useSearchParams();
  const schedules = useQuery<{ data: Schedule[] }>("/donor-schedules");
  const listings = useQuery<Rows<Listing>>("/listings/mine?limit=100");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function save(body: {
    template_listing_id: number;
    local_time: string;
    time_zone: string;
    enabled: boolean;
  }) {
    if (!auth.session) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/donor-schedules", {
        method: "PUT",
        csrf: auth.session.csrf_token,
        body,
      });
      schedules.refresh();
      setNotice("Daily schedule saved.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save({
      template_listing_id: Number(form.get("listing")),
      local_time: String(form.get("time")),
      time_zone: "Asia/Kolkata",
      enabled: true,
    });
  }
  return (
    <Access roles={["Donor"]}>
      <Workspace
        title="Recurring donations"
        intro="Save your evening donation routine. We remind you to confirm today's surplus before publishing."
      >
        <QueryStatus {...schedules} />
        <QueryStatus {...listings} />
        <Feedback error={error} notice={notice} />
        <form onSubmit={submit}>
          <fieldset className="form-fields" disabled={busy}>
            <div className="field">
              <label htmlFor="schedule-listing">Use a previous donation</label>
              <select
                id="schedule-listing"
                name="listing"
                defaultValue={search.get("listing") ?? ""}
                required
              >
                <option value="">Choose donation</option>
                {listings.data?.data.map((l) => (
                  <option key={l.listing_id} value={l.listing_id}>
                    {l.food_type} · #{l.listing_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="schedule-time">Every day at (India time)</label>
              <input
                id="schedule-time"
                name="time"
                type="time"
                defaultValue="20:00"
                required
              />
            </div>
            <p>
              Each reminder opens a fresh donation form. Check today's quantity,
              collection deadline, ingredients and handling; food is never
              published automatically.
            </p>
            <button type="submit" className="button">
              Save daily schedule
            </button>
          </fieldset>
        </form>
        <section aria-label="Saved daily schedules">
          <h2>Your schedules</h2>
          {schedules.data?.data.length === 0 && (
            <p>
              No schedules yet. Share your first donation to create a reusable
              template.
            </p>
          )}
          {schedules.data?.data.map((s) => (
            <article className="settings-section" key={s.schedule_id}>
              <h3>{s.food_type}</h3>
              <p>
                Daily at {s.local_time.slice(0, 5)} · {s.time_zone} ·{" "}
                {s.enabled ? `Next reminder ${date(s.next_due_at)}` : "Paused"}
              </p>
              <div className="actions">
                <Link
                  className="button button-outline"
                  to={`/donations/new?repeat=${s.template_listing_id}`}
                >
                  Confirm today's donation
                </Link>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void save({ ...s, enabled: !s.enabled })}
                >
                  {s.enabled ? "Pause" : "Resume"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </Workspace>
    </Access>
  );
}
