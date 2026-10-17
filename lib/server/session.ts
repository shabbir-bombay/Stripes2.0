import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "../types";

// The session cookie holds "payload.signature", both base64url. The payload is { u: user id, r: role, e: expiry ms },
// signed with HMAC-SHA256 and AUTH_SECRET. The role is in it so proxy.ts can route without a database call;
// endpoints still load the user from the database.

export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const ROLES: Role[] = ["student", "driver", "admin"];

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MS / 1000,
} as const;

function sign(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters (see .env.example)");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, role: Role, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: userId, r: role, e: now + SESSION_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The session in a cookie value, or null if it is forged, malformed or expired. */
export function readSessionToken(token: string, now = Date.now()): { userId: string; role: Role } | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const { u, r, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof u !== "string" || !ROLES.includes(r) || typeof e !== "number" || e <= now) return null;
    return { userId: u, role: r };
  } catch {
    return null;
  }
}
