import type { Role, UpdateUserRequest } from "../types";

// The rules for changing accounts, as pure functions. The routes apply the result to the database.

export const ROLES: Role[] = ["student", "driver", "admin"];

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseName(value: unknown): Parsed<string> {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80) return { ok: false, error: "Enter your name (up to 80 characters)." };
  return { ok: true, value: name };
}

export function parseUserUpdate(body: Record<string, unknown> | null): Parsed<UpdateUserRequest> {
  const { role, suspended, callSign } = body ?? {};
  const update: UpdateUserRequest = {};
  if (role !== undefined) {
    if (!ROLES.includes(role as Role)) return { ok: false, error: "Role must be student, driver or admin." };
    update.role = role as Role;
  }
  if (suspended !== undefined) {
    if (typeof suspended !== "boolean") return { ok: false, error: "Suspended must be true or false." };
    update.suspended = suspended;
  }
  if (callSign !== undefined) {
    const text = typeof callSign === "string" ? callSign.trim() : "";
    if (!text || text.length > 30) return { ok: false, error: "Enter a call sign (up to 30 characters)." };
    update.callSign = text;
  }
  if (Object.keys(update).length === 0) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: update };
}

export interface UserTarget {
  id: string;
  name: string;
  role: Role;
  suspended: boolean;
  /** Null if they have never been a driver. */
  callSign: string | null;
  onShift: boolean;
  /** Rides they asked for that aren't over. */
  ridesAsStudent: number;
  /** Rides they hold as the driver. */
  ridesAsDriver: number;
}

export type UserPlan =
  | {
      ok: true;
      /** What goes on the user row. */
      user: { role?: Role; suspended?: boolean };
      /** Create or rename the driver profile. */
      callSign?: string;
      /** Free their cart: they're losing driver access while on shift. */
      endShift: boolean;
    }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Whether an admin may make this change. An admin can't lock themselves out, which also means one admin always remains.
 * Taking away someone's access while they are part of a live ride would strand the ride, so that waits until it is
 * finished, reassigned or canceled. A driver with no rides just comes off shift, so a cart is never stuck.
 */
export function planUserUpdate(target: UserTarget, adminId: string, update: UpdateUserRequest): UserPlan {
  const role = update.role ?? target.role;
  const roleChanges = role !== target.role;
  const suspending = update.suspended === true && !target.suspended;

  if (target.id === adminId && (roleChanges || suspending)) {
    return { ok: false, status: 409, error: "You can't change your own role or suspend yourself. Ask another admin." };
  }
  if (update.callSign !== undefined && role !== "driver") return { ok: false, status: 400, error: "Only drivers have a call sign." };
  if (role === "driver" && !target.callSign && update.callSign === undefined) {
    return { ok: false, status: 400, error: "Give this driver a call sign." };
  }

  const losingAccess = roleChanges || suspending;
  if (losingAccess && target.ridesAsStudent > 0) {
    return { ok: false, status: 409, error: `${target.name} has a ride that isn't over. Cancel it first.` };
  }
  if (losingAccess && target.ridesAsDriver > 0) {
    return { ok: false, status: 409, error: `${target.name} is holding a ride. Reassign or cancel it first.` };
  }

  return {
    ok: true,
    user: { ...(update.role !== undefined && { role: update.role }), ...(update.suspended !== undefined && { suspended: update.suspended }) },
    ...(update.callSign !== undefined && { callSign: update.callSign }),
    endShift: losingAccess && target.onShift,
  };
}

export type DeletePlan = { ok: true } | { ok: false; status: 409; error: string };

/**
 * Whether an admin may delete this account. Deleting takes the rides they asked for and the penalty points they got
 * with it, so it waits until no ride of theirs is live, for the same reason as taking access away. An admin can't
 * delete themselves, which also means one admin always remains.
 */
export function planUserDelete(target: UserTarget, adminId: string): DeletePlan {
  if (target.id === adminId) return { ok: false, status: 409, error: "You can't delete your own account. Ask another admin." };
  if (target.ridesAsStudent > 0) return { ok: false, status: 409, error: `${target.name} has a ride that isn't over. Cancel it first.` };
  if (target.ridesAsDriver > 0) return { ok: false, status: 409, error: `${target.name} is holding a ride. Reassign or cancel it first.` };
  return { ok: true };
}
