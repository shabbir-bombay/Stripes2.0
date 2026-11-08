import type { PushSubscriptionInput, Role } from "../types";

// The parts of push alerts that don't need the network or the database, as pure functions so they can be tested.

/** A notice older than this is too late to be worth an alert, e.g. after the server was down for a while. */
export const PUSH_MAX_AGE_MS = 5 * 60_000;

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** The subscription a browser sent, checked: an https endpoint and keys of the right shape. */
export function parseSubscription(body: Record<string, unknown> | null): { ok: true; value: PushSubscriptionInput } | { ok: false; error: string } {
  const bad = { ok: false as const, error: "That isn't a browser push subscription." };
  const { endpoint, keys } = body ?? {};
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !URL.canParse(endpoint) || new URL(endpoint).protocol !== "https:") return bad;
  const { p256dh, auth } = (keys && typeof keys === "object" ? keys : {}) as Record<string, unknown>;
  // p256dh is a 65-byte public key (87 characters), auth a 16-byte secret (22), in base64url.
  if (typeof p256dh !== "string" || !BASE64URL.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) return bad;
  if (typeof auth !== "string" || !BASE64URL.test(auth) || auth.length < 16 || auth.length > 32) return bad;
  return { ok: true, value: { endpoint, keys: { p256dh, auth } } };
}

export interface PushNotice {
  id: string;
  text: string;
  rideId: string | null;
  role: Role;
}

/**
 * What the service worker shows. Tapping it opens the person's notifications. Alerts about the same ride share a tag,
 * so a newer one replaces the older on the lock screen instead of piling up.
 */
export function pushPayload(notice: PushNotice): string {
  return JSON.stringify({ title: "Stripes", body: notice.text, url: `/${notice.role}/notifications`, tag: notice.rideId ?? notice.id });
}

/** The push service says this subscription no longer exists, so stop sending to it. */
export const isGone = (statusCode: number | undefined) => statusCode === 404 || statusCode === 410;
