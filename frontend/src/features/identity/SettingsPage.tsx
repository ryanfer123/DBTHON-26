import { BrowserPushSettings } from "./BrowserPushSettings";
import { InstallApp } from "../../components/InstallApp";
import { useState } from "react";
import { api, ApiError } from "../../lib/identity";
import { useAuth } from "./AuthContext";
import { invalidateOverview } from "../workflows/OverviewContext";
import { useQuery } from "../workflows/data";
import { Feedback, QueryStatus, Workspace } from "../workflows/Workspace";

type Preferences = {
  whatsapp_enabled: boolean;
  whatsapp_configured: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  sms_configured: boolean;
  push_configured: boolean;
};

export function SettingsPage() {
  const auth = useAuth();
  const query = useQuery<{ data: Preferences }>("/settings/notifications");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(
    field: "sms_enabled" | "push_enabled" | "whatsapp_enabled",
    value: boolean,
  ) {
    if (!query.data || !auth.session) return;
    const next = { ...query.data.data, [field]: value };
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ data: Preferences }>(
        "/settings/notifications",
        {
          method: "PATCH",
          csrf: auth.session.csrf_token,
          body: {
            whatsapp_enabled: next.whatsapp_enabled,
            sms_enabled: next.sms_enabled,
            push_enabled: next.push_enabled,
          },
        },
      );
      query.refresh();
      setNotice(
        field === "whatsapp_enabled" &&
          value &&
          !result.data.whatsapp_configured
          ? "Your WhatsApp preference is saved. Provider setup and an approved notification template are still required."
          : field === "sms_enabled" && value && !result.data.sms_configured
            ? "Your SMS preference is saved. External SMS delivery needs provider setup and a verified phone number."
            : field === "push_enabled" && value && !result.data.push_configured
              ? "Your push preference is saved. Push alerts are currently unavailable."
              : "Notification preferences saved.",
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clearHistory() {
    if (
      !auth.session ||
      !window.confirm(
        "Clear all notifications from your inbox? This only hides them from your account.",
      )
    )
      return;
    setClearing(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ cleared: number }>("/notifications/clear", {
        method: "POST",
        csrf: auth.session.csrf_token,
        body: {},
      });
      invalidateOverview();
      setNotice(
        `${result.cleared} inbox ${result.cleared === 1 ? "item was" : "items were"} cleared.`,
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <Workspace
      title="Settings"
      intro="Choose how community updates reach you and manage your account history."
    >
      <QueryStatus {...query} />
      {query.data && (
        <section
          className="settings-section"
          aria-labelledby="notification-settings-heading"
        >
          <h2 id="notification-settings-heading">Notifications</h2>
          <p className="field-help">
            Inbox updates are always available. External alerts are optional and
            use your saved phone number or browser.
          </p>
          <label className="review-check">
            <input
              type="checkbox"
              checked={query.data.data.sms_enabled}
              disabled={saving}
              onChange={(event) =>
                void save("sms_enabled", event.target.checked)
              }
            />
            SMS alerts
          </label>
          <p className="field-help">
            {query.data.data.sms_configured
              ? "SMS alerts are enabled for an approved phone number, subject to a daily limit."
              : "Save your preference now. External SMS needs provider setup and a verified phone number."}
          </p>
          <label className="review-check">
            <input
              type="checkbox"
              checked={query.data.data.whatsapp_enabled}
              disabled={saving}
              onChange={(event) =>
                void save("whatsapp_enabled", event.target.checked)
              }
            />
            WhatsApp alerts
          </label>
          <p className="field-help">
            {query.data.data.whatsapp_configured
              ? "WhatsApp alerts are enabled for the approved phone number. Delivery confirmation depends on the messaging provider."
              : "Save your preference now. WhatsApp needs provider setup, a registered phone number and an approved notification template."}
          </p>
          <Feedback error={error} notice={notice} />
        </section>
      )}
      <BrowserPushSettings onChange={query.refresh} />
      <InstallApp />
      <section className="settings-section" aria-labelledby="history-heading">
        <h2 id="history-heading">Inbox history</h2>
        <p>
          Clear notifications from your inbox. This hides them from your account
          while preserving audit records.
        </p>
        <button
          className="button button-outline button-small"
          disabled={clearing}
          onClick={() => void clearHistory()}
        >
          {clearing ? "Clearing…" : "Clear inbox history"}
        </button>
      </section>
    </Workspace>
  );
}
