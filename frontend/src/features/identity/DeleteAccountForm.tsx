import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, ApiError, type User } from "../../lib/identity";
import { currentPushSubscription } from "../../lib/browserPush";
import { invalidateOverview } from "../workflows/OverviewContext";
import { useAuth } from "./AuthContext";

export function DeleteAccountForm({
  user,
  admin = false,
  onDeleted,
}: {
  user: User;
  admin?: boolean;
  onDeleted?: () => void;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const protectedAccount = user.email === "z1.admin@example.invalid";
  const matches = confirmation.trim().toLowerCase() === user.email;

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || busy || !auth.session) return;
    setBusy(true);
    setError("");
    try {
      await api<void>(admin ? `/admin/users/${user.user_id}` : "/auth/me", {
        method: "DELETE",
        csrf: auth.session.csrf_token,
        body: { confirmation_email: confirmation.trim() },
      });
      invalidateOverview();
      if (admin) onDeleted?.();
      else {
        // Server deletion has committed; local browser cleanup cannot undo it.
        await currentPushSubscription()
          .then((subscription) => subscription?.unsubscribe())
          .catch(() => undefined);
        auth.expire();
        navigate("/", { replace: true });
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) auth.expire();
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (protectedAccount)
    return (
      <p className="field-help">
        The main administrator account is protected from deletion.
      </p>
    );
  return (
    <div className="review-panel">
      {!open ? (
        <button
          className="button button-outline button-small"
          onClick={() => setOpen(true)}
        >
          {admin ? "Delete account" : "Delete my account"}
        </button>
      ) : (
        <form className="review-form" onSubmit={remove} aria-busy={busy}>
          <fieldset className="form-fields" disabled={busy}>
            <legend>
              {admin
                ? `Delete ${user.name}’s account`
                : "Permanently delete your account"}
            </legend>
            <p>
              Deletion removes login access, profile details, preferences and
              schedules. Exchange history, messages and audit records remain
              linked to “Deleted account”. This cannot be undone.
            </p>
            <p className="field-help">
              Finish or cancel active donations and exchanges first. An area’s
              last administrator must appoint another administrator before
              deletion.
            </p>
            <div className="field">
              <label htmlFor={`delete-email-${user.user_id}`}>
                Type {user.email} to confirm
              </label>
              <input
                id={`delete-email-${user.user_id}`}
                type="text"
                required
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                className="button button-small"
                type="submit"
                disabled={!matches}
              >
                {busy ? "Deleting…" : "Permanently delete account"}
              </button>
              <button
                className="button button-outline button-small"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmation("");
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
