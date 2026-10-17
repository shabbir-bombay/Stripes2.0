import { cookies } from "next/headers";
import type { Me, Role } from "../types";
import { db } from "./db";
import type { User } from "./generated/prisma/client";
import { createSessionToken, readSessionToken, SESSION_COOKIE, sessionCookieOptions } from "./session";

/** Sends an ApiError with the given status. */
export function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** The JSON body as an object, or null if it isn't one. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

/** The user in the session cookie, or null. Suspended users are returned too; check `suspended`. */
export async function sessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? readSessionToken(token) : null;
  return session ? db.user.findUnique({ where: { id: session.userId } }) : null;
}

/**
 * The signed-in user, or the error response to send instead.
 * With roles given, any other role gets 403.
 *
 *   const user = await requireUser("student");
 *   if (user instanceof Response) return user;
 */
export async function requireUser(...roles: Role[]): Promise<User | Response> {
  const user = await sessionUser();
  if (!user) return fail(401, "Please sign in.");
  if (user.suspended) return fail(403, "This account is suspended.");
  if (roles.length && !roles.includes(user.role)) return fail(403, "You don't have access to this.");
  return user;
}

export async function startSession(user: User) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id, user.role), sessionCookieOptions);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function toMe({ id, email, name, role }: User): Me {
  return { id, email, name, role };
}
