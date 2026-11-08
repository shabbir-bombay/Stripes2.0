// The browser side of push alerts: the service worker in public/sw.js shows them.

/** Push needs a service worker and the Push API. iPhones only have them once Stripes is added to the Home Screen. */
export function pushSupport(): "yes" | "install-first" | "no" {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "yes";
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return iOS && !standalone ? "install-first" : "no";
}

/** This browser's current subscription, if alerts are on. */
export async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** The server key in the form `subscribe` wants. */
export function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Turns alerts off for this browser, here and on the server. Used before signing out, so the next person's phone doesn't get yours. */
export async function stopAlerts() {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}
