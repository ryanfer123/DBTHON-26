import { api } from "./identity";

export function pushSupported() {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function disableBrowserPush(csrf: string) {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  // Revoke on the server first. Failed requests retain the subscription for retry.
  await api("/push/unsubscribe", {
    method: "POST",
    csrf,
    body: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}
