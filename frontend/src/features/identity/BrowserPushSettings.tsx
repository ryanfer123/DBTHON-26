import { useEffect, useState } from "react";
import { api } from "../../lib/identity";
import {
  currentPushSubscription,
  disableBrowserPush,
  pushSupported,
} from "../../lib/browserPush";
import { Feedback } from "../workflows/Workspace";
import { useAuth } from "./AuthContext";

type PushConfig = { configured: boolean; public_key: string };

export function BrowserPushSettings({ onChange }: { onChange: () => void }) {
  const { session } = useAuth();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const supported = pushSupported();

  useEffect(() => {
    if (!session || !supported) return;
    let active = true;
    const csrf = session.csrf_token;
    void (async () => {
      try {
        const [result, subscription] = await Promise.all([
          api<{ data: PushConfig }>("/push/config"),
          currentPushSubscription(),
        ]);
        const status = subscription
          ? await api<{ data: { enabled: boolean } }>("/push/status", {
              method: "POST",
              csrf,
              body: { endpoint: subscription.endpoint },
            })
          : null;
        if (active) {
          setConfig(result.data);
          setEnabled(Boolean(status?.data.enabled));
        }
      } catch (cause) {
        if (active) setError((cause as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, supported]);

  async function enable() {
    if (!session || !config?.configured) return;
    // Call permission immediately in the user's click handler, before other awaits.
    const permission = Notification.requestPermission();
    setBusy(true);
    setError("");
    setNotice("");
    let subscription: PushSubscription | null = null;
    let created = false;
    try {
      if ((await permission) !== "granted")
        throw new Error(
          "Allow notifications in your browser's site settings, then try again.",
        );
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () =>
              reject(
                new Error(
                  "Browser notification setup timed out. Refresh and try again.",
                ),
              ),
            15000,
          ),
        ),
      ]);
      subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Explicit opt-in rotates the browser capability, avoiding account transfer.
        await disableBrowserPush(session.csrf_token);
      }
      const padded = config.public_key.replace(/-/g, "+").replace(/_/g, "/");
      const key = Uint8Array.from(
        atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)),
        (c) => c.charCodeAt(0),
      );
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      created = true;
      await api("/push/subscribe", {
        method: "POST",
        csrf: session.csrf_token,
        body: subscription.toJSON(),
      });
      setEnabled(true);
      onChange();
      setNotice(
        "Browser alerts enabled. New inbox updates can appear even when this tab is closed.",
      );
    } catch (cause) {
      if (created && subscription)
        await subscription.unsubscribe().catch(() => false);
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!session) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await disableBrowserPush(session.csrf_token);
      setEnabled(false);
      onChange();
      setNotice("Alerts disabled for this browser.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section" aria-labelledby="push-heading">
      <h2 id="push-heading">Browser notifications</h2>
      <p>
        Get alerts for new inbox updates. Notification previews contain no
        private messages or contact details.
      </p>
      {!supported ? (
        <p className="field-help">
          This browser does not support push here. On iPhone or iPad, add NomNom
          to your Home Screen and open it there.
        </p>
      ) : (
        <>
          <p className="field-help">
            {enabled
              ? Notification.permission === "granted"
                ? "Enabled for this browser. Signing out disconnects it."
                : "Your browser is blocking alerts. Allow notifications in site settings, or disable this subscription."
              : loading
                ? "Checking browser alerts…"
                : config?.configured
                  ? "Enable alerts to choose whether this browser can notify you. Your device settings control when alerts appear."
                  : "Browser alerts are awaiting server setup."}
          </p>
          <button
            className="button button-outline button-small"
            disabled={busy || loading || (!enabled && !config?.configured)}
            onClick={() => void (enabled ? disable() : enable())}
          >
            {busy
              ? "Saving…"
              : enabled
                ? "Disable browser alerts"
                : "Enable browser alerts"}
          </button>
        </>
      )}
      <Feedback error={error} notice={notice} />
    </section>
  );
}
